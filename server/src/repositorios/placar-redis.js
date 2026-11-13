// Repositório NoSQL do placar: um Sorted Set do Redis (DEC-012).
// Escrito pelo agente em 12/11/2026 (DEC-009).
//
// Sorted Set (ZSET) = conjunto de membros únicos, cada um com uma nota (score), mantido
// SEMPRE ordenado pelo Redis. É a estrutura que a especificação de BD2 sugere para
// "Plataforma de Ensino / Gamificação: placar de líderes (leaderboards) em tempo real".
//
//   chave:   ranking:placar:v1
//   membro:  id do usuário ("1121")
//   score:   número que codifica a RN12 inteira (ver scoreDe)
//
// Comandos usados e custo:
//   ZADD   insere/atualiza um membro ............ O(log N)
//   ZREVRANK posição de um membro (maior → menor) O(log N)   ← o motivo de usar ZSET
//   ZSCORE  score de um membro .................. O(1)
//   ZCARD   quantos membros ..................... O(1)
// Com N = 5.876 participantes, log2(N) ≈ 13 passos, contra numerar o ranking inteiro no SQL.
const cache = require('../cache');

const CHAVE_PLACAR = 'ranking:placar:v1';
// O placar se refaz sozinho a cada 10 min, no pior caso. Limita o efeito de uma corrida rara
// entre a reconstrução e uma aprovação (manual, cap. 7). Sem disco no Redis, ele também
// volta vazio depois de um restart, e é reconstruído do PostgreSQL na primeira leitura.
const TTL_PLACAR_SEGUNDOS = 600;
const BASE = 1e10;

// RN12 num número só: mais pontos primeiro; empate → quem recebeu a última concessão ANTES.
//   score = total_pontos × 10^10 + (10^10 − segundos_desde_1970_da_ultima_concessao)
// Exemplo: 280 pontos com última concessão em 18/08/2026 (1.787.000.000 s)
//   → 280 × 10^10 + (10^10 − 1.787.000.000) = 2.808.213.000.000 (cabe com folga no double)
// Limite: exato até ~900.000 pontos (2^53). Empate no MESMO segundo cai na ordem do membro.
function scoreDe(totalPontos, ultimaConcessao) {
  const segundos = Math.floor(new Date(ultimaConcessao).getTime() / 1000);
  return Number(totalPontos) * BASE + (BASE - segundos);
}

function pontosDoScore(score) {
  return Math.floor(Number(score) / BASE);
}

async function existe() {
  return (await cache.cliente.exists(CHAVE_PLACAR)) === 1;
}

// Reconstrói o placar inteiro numa transação do Redis (MULTI/EXEC): quem lê nunca vê um
// placar pela metade.
async function reconstruir(linhas) {
  const multi = cache.cliente.multi().del(CHAVE_PLACAR);
  for (let i = 0; i < linhas.length; i += 1000) {
    multi.zAdd(
      CHAVE_PLACAR,
      linhas.slice(i, i + 1000).map((l) => ({
        score: scoreDe(l.total_pontos, l.ultima_concessao),
        value: String(l.id_usuario),
      }))
    );
  }
  multi.expire(CHAVE_PLACAR, TTL_PLACAR_SEGUNDOS);
  await multi.exec();
}

// Write-Through: depois do COMMIT de uma aprovação, grava o novo score do membro.
// Só grava se o placar EXISTIR. Se ele não existe (Redis reiniciou, TTL venceu), gravar um
// membro sozinho criaria um placar com 1 pessoa, e todo mundo leria "posição 1".
// O teste e o ZADD acontecem num script Lua, que o Redis executa de forma atômica.
const SCRIPT_ZADD_SE_EXISTE = `
  if redis.call('EXISTS', KEYS[1]) == 1 then
    return redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
  end
  return -1`;

async function gravarSeExistir(idUsuario, totalPontos, ultimaConcessao) {
  const r = await cache.cliente.eval(SCRIPT_ZADD_SE_EXISTE, {
    keys: [CHAVE_PLACAR],
    arguments: [String(scoreDe(totalPontos, ultimaConcessao)), String(idUsuario)],
  });
  return r !== -1; // false = placar não existia; será reconstruído na próxima leitura
}

// Posição (1 = primeiro), score e total de participantes, numa ida só ao Redis.
async function posicaoDe(idUsuario) {
  const [rank, score, total] = await cache.cliente
    .multi()
    .zRevRank(CHAVE_PLACAR, String(idUsuario))
    .zScore(CHAVE_PLACAR, String(idUsuario))
    .zCard(CHAVE_PLACAR)
    .exec();
  if (rank === null) return { posicao: null, total_pontos: 0, total_participantes: total };
  return { posicao: rank + 1, total_pontos: pontosDoScore(score), total_participantes: total };
}

module.exports = {
  CHAVE_PLACAR,
  scoreDe,
  existe,
  reconstruir,
  gravarSeExistir,
  posicaoDe,
};
