// ESCRITO POR VOCÊ (Fideles). Quinta, 12/11, 22h15.
//
// Padrão Cache-Aside na leitura do ranking. Passos (seção 4.5 e diagrama 5.5 do planejamento):
//
//   1. Tentar ler do Redis a chave CHAVE_RANKING        -> cache.ler(CHAVE_RANKING)
//   2. Se veio algo (cache hit): JSON.parse e devolver, marcando origem: 'cache'
//   3. Se veio null (miss, expirou ou Redis fora):
//        a. consultar o PostgreSQL pela vw_ranking_consolidado, com ORDER BY explícito
//           (RN12: total DESC, última concessão ASC, id do usuário ASC)
//           -> pool.query('SELECT ... FROM vw_ranking_consolidado ORDER BY ...')
//        b. montar { gerado_em, participantes: [...] }
//        c. tentar gravar no Redis com TTL      -> cache.gravar(CHAVE_RANKING, JSON.stringify(...), TTL_SEGUNDOS)
//           (se falhar, NÃO é erro: segue a vida)
//        d. devolver, marcando origem: 'postgres'
//
// Perguntas para saber responder:
//   - Por que o Redis não é a fonte oficial?
//   - O que acontece se uma aprovação entrar entre o passo 3a e o 3c? (corrida de cache)
//   - Por que o TTL não é renovado na leitura?
const { pool } = require('../db');
const cache = require('../cache');

const CHAVE_RANKING = 'ranking:geral:v1';
const TTL_SEGUNDOS = 60;

async function obterRanking() {
  // TODO(Fideles): escrever os passos acima e apagar a linha abaixo.
  const erro = new Error('obterRanking ainda não implementado');
  erro.naoImplementado = true;
  throw erro;
}

module.exports = { obterRanking, CHAVE_RANKING, TTL_SEGUNDOS };
