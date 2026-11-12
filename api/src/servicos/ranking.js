// Ranking geral com o padrão Cache-Aside (RF11, RNF06, DEC-005).
// Escrito pelo agente em 12/11/2026 a partir do roteiro do Fideles (DEC-009).
//
//   1. tenta ler do Redis (timeout curto em cache.js)
//   2. achou (cache hit)  → devolve, com origem 'cache'
//   3. não achou (miss, expirou ou Redis fora) → consulta o PostgreSQL pela view,
//      tenta gravar no Redis com TTL e devolve, com origem 'postgres'
//
// Perguntas que caem:
//   - Por que o Redis não é a fonte oficial? Porque ele guarda uma CÓPIA calculada e
//     descartável (sem disco, TTL de 60 s). Se sumir, este arquivo refaz a partir do SQL.
//   - E se uma aprovação entrar entre a consulta ao Postgres e o SET no Redis? (corrida)
//     O ranking gravado fica velho por até 60 s (TTL). É o preço aceito do Cache-Aside:
//     atraso limitado, nunca dado inventado. A tela mostra "atualizado há X s".
//   - Por que não renovar o TTL a cada leitura? Porque aí um ranking velho poderia viver
//     para sempre enquanto alguém continuasse lendo.
const { pool } = require('../db');
const cache = require('../cache');
const { ErroHttp } = require('../erros');

const CHAVE_RANKING = 'ranking:geral:v1';
const TTL_SEGUNDOS = 60;
const TAMANHO = 100; // a tela mostra o top 100; o total de participantes vai junto

// RN12: total desc, última concessão asc (quem chegou primeiro), id asc (desempate final).
const SQL_RANKING = `
  SELECT id_usuario, nome, total_pontos, ultima_concessao,
         count(*) OVER ()::int AS total_participantes
  FROM vw_ranking_consolidado
  ORDER BY total_pontos DESC, ultima_concessao ASC, id_usuario ASC
  LIMIT $1`;

async function obterRanking() {
  const doCache = await cache.ler(CHAVE_RANKING);
  if (doCache) {
    return { origem: 'cache', ...JSON.parse(doCache) };
  }

  let linhas;
  try {
    ({ rows: linhas } = await pool.query(SQL_RANKING, [TAMANHO]));
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

module.exports = { obterRanking, CHAVE_RANKING, TTL_SEGUNDOS };
