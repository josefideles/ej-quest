// Ranking: dois padrões de sincronização entre PostgreSQL e Redis (RF11, RNF06).
// Escrito pelo agente em 12/11/2026 a partir do roteiro do Fideles (DEC-005, DEC-009, DEC-012).
//
// 1) TOP 100 (GET /ranking) · Cache-Aside, string JSON com TTL de 60 s
//    lê o Redis → não achou → consulta o PostgreSQL → grava no Redis → devolve
//
// 2) MINHA POSIÇÃO (GET /ranking/eu) · Sorted Set + Write-Through
//    o placar ZSET tem todos os participantes; a aprovação atualiza o score do membro
//    logo depois do COMMIT (aprovacao.js). A posição sai de um ZREVRANK, em O(log N).
//
// Perguntas que caem:
//   - Por que o Redis não é a fonte oficial? Porque guarda CÓPIAS calculadas e descartáveis
//     (sem disco, com TTL). Se sumir, este arquivo refaz tudo a partir do SQL.
//   - Por que dois padrões? Cada um serve a uma leitura: o top 100 é igual para todos e muda
//     pouco (cache pronto); a posição é diferente para cada um dos ~5.900 participantes e
//     precisaria numerar o ranking inteiro a cada consulta no SQL (o ZSET já guarda ordenado).
//   - E se uma aprovação entrar entre a consulta ao Postgres e o SET no Redis? (corrida)
//     O top 100 gravado fica velho por até 60 s (TTL). Atraso limitado, nunca dado inventado.
const sql = require('../repositorios/postgres');
const placar = require('../repositorios/placar-redis');
const cache = require('../cache');
const { ErroHttp } = require('../erros');

const CHAVE_RANKING = 'ranking:geral:v1';
const TTL_SEGUNDOS = 60;
const TAMANHO = 100; // a tela mostra o top 100; o total de participantes vai junto

// ------------------------------------------------------------------ 1) Cache-Aside
async function obterRanking() {
  const doCache = await cache.ler(CHAVE_RANKING);
  if (doCache) {
    return { origem: 'cache', ...JSON.parse(doCache) };
  }

  let linhas;
  try {
    linhas = await sql.topRanking(TAMANHO);
  } catch (erro) {
    // Sem cache e sem Postgres: não inventa ranking (constituição, item 7).
    console.error('[ranking] PostgreSQL indisponível:', erro.message);
    throw new ErroHttp(503, 'Ranking indisponível no momento');
  }

  const ranking = {
    gerado_em: new Date().toISOString(),
    total_participantes: linhas[0] ? linhas[0].total_participantes : 0,
    participantes: linhas.map((l, i) => ({
      posicao: i + 1,
      id_usuario: Number(l.id_usuario),
      nome: l.nome,
      total_pontos: l.total_pontos,
      ultima_concessao: l.ultima_concessao,
    })),
  };

  // Se o Redis estiver fora, gravar falha em silêncio e a resposta segue normal (RNF06).
  await cache.gravar(CHAVE_RANKING, JSON.stringify(ranking), TTL_SEGUNDOS);
  return { origem: 'postgres', ...ranking };
}

// ------------------------------------------------------------------ 2) Sorted Set
// Garante que o placar existe; se não existir, reconstrói a partir do PostgreSQL.
async function garantirPlacar() {
  if (await cache.comTimeout(placar.existe())) return 'cache';
  const linhas = await sql.rankingCompleto();
  await cache.comTimeout(placar.reconstruir(linhas));
  return 'reconstruido';
}

async function obterMinhaPosicao(idUsuario) {
  try {
    const situacao = await garantirPlacar();
    const pos = await cache.comTimeout(placar.posicaoDe(idUsuario));
    return { origem: situacao === 'cache' ? 'redis' : 'redis (placar reconstruído)', id_usuario: idUsuario, ...pos };
  } catch (erro) {
    // Redis fora ou lento: a mesma resposta, calculada pelo SQL (RNF06).
    console.warn('[ranking] placar indisponível, calculando pelo PostgreSQL:', erro.message);
  }
  const linha = await sql.posicaoPorSql(idUsuario);
  if (linha) return { origem: 'postgres', id_usuario: idUsuario, ...linha };
  return { origem: 'postgres', id_usuario: idUsuario, posicao: null, total_pontos: 0,
           total_participantes: await sql.contarParticipantes() };
}

// Write-Through: chamado DEPOIS do COMMIT de uma aprovação nova.
// Devolve true se o placar foi atualizado; false se o Redis estava fora ou o placar não
// existia (nos dois casos, a próxima leitura reconstrói a partir do PostgreSQL).
async function atualizarPlacarDe(idUsuario) {
  try {
    const linha = await sql.rankingDoUsuario(idUsuario);
    if (!linha) return false; // usuário desligado: some do placar na próxima reconstrução
    return await cache.comTimeout(
      placar.gravarSeExistir(idUsuario, linha.total_pontos, linha.ultima_concessao)
    );
  } catch (erro) {
    console.warn('[ranking] falha no Write-Through do placar:', erro.message);
    return false;
  }
}

// Depois do COMMIT de qualquer operação que gerou pontos (desafio aprovado ou quiz aprovado):
//   1. Cache-Aside: DEL do top 100;  2. Write-Through: ZADD do novo score do membro no placar.
async function sincronizarAposPontos(idMembro) {
  const rankingInvalidado = await cache.apagar(CHAVE_RANKING);
  const placarAtualizado = idMembro ? await atualizarPlacarDe(idMembro) : false;
  return { ranking_invalidado: rankingInvalidado, placar_atualizado: placarAtualizado };
}

module.exports = {
  obterRanking,
  obterMinhaPosicao,
  atualizarPlacarDe,
  sincronizarAposPontos,
  CHAVE_RANKING,
  TTL_SEGUNDOS,
};
