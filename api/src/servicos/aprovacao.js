// ESCRITO POR VOCÊ (Fideles). Quinta, 12/11, 22h15.
//
// Aprovação de projeto: a API abre a transação, a procedure faz o trabalho, e o cache é
// invalidado só DEPOIS do COMMIT (diagrama 5.6 do planejamento). Passos:
//
//   1. const client = await pool.connect()          (UMA conexão só para a transação)
//   2. try {
//        await client.query('BEGIN')
//        chamar a procedure com parâmetros ($1, $2, $3), NUNCA concatenando texto:
//          CALL aprovar_projeto($1, $2, $3, NULL)
//          -> o INOUT p_status volta como coluna no resultado (rows[0].p_status)
//        await client.query('COMMIT')
//      } catch (erro) {
//        await client.query('ROLLBACK')               (desfaz tudo: nada gravado pela metade)
//        relançar o erro (ou traduzir para 409/403 conforme a mensagem da procedure)
//      } finally {
//        client.release()                             (devolve a conexão ao pool, SEMPRE)
//      }
//   3. Se o status for 'aprovada' (aprovação nova): cache.apagar(CHAVE_RANKING)
//      Se falhar, só registrar no log: a aprovação JÁ está confirmada no Postgres.
//   4. Devolver { status, ranking_invalidado: true/false }
//
// Perguntas para saber responder:
//   - Por que o DEL vem depois do COMMIT e não antes?
//   - Por que não usar pool.query para o BEGIN e o COMMIT?
//   - O que é SQL injection e por que $1 protege?
//   - O gestor clicou duas vezes. O que cada chamada devolve?
const { pool } = require('../db');
const cache = require('../cache');
const { CHAVE_RANKING } = require('./ranking');

async function aprovarProjeto({ idTentativa, idAvaliador, parecer }) {
  // TODO(Fideles): escrever os passos acima e apagar a linha abaixo.
  const erro = new Error('aprovarProjeto ainda não implementado');
  erro.naoImplementado = true;
  throw erro;
}

module.exports = { aprovarProjeto };
