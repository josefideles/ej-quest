// Parecer do gestor sobre um desafio: aprovar ou pedir ajustes (RF08, RN09, RNF02, RNF03).
// Escrito pelo agente em 12/11/2026 a partir do roteiro do Fideles (DEC-008, DEC-009).
//
// Divisão de trabalho:
//   - a API abre e fecha a transação (emTransacao) e invalida o cache;
//   - a procedure trava a participação (FOR UPDATE), confere permissão e estado e grava;
//   - a trigger grava os pontos quando nasce a conclusão.
//
// Perguntas que caem:
//   - Por que o DEL do cache vem DEPOIS do COMMIT? Se viesse antes, outra requisição poderia
//     ler o ranking do Postgres ANTES do COMMIT (ainda sem os pontos novos) e gravar essa
//     versão velha no Redis, que ficaria lá até o TTL vencer.
//   - E se o DEL falhar (Redis fora)? A aprovação já está confirmada no Postgres. O ranking
//     fica velho por até 60 s, e a resposta avisa com ranking_invalidado: false.
//   - O que é SQL injection e por que $1 protege? Os valores vão separados do texto do SQL;
//     o banco nunca interpreta o parecer como comando.
//   - O gestor clicou duas vezes. O que cada chamada devolve? 'aprovada' e 'ja_aprovada'.
const cache = require('../cache');
const { emTransacao } = require('../transacao');
const { CHAVE_RANKING } = require('./ranking');

async function darParecer(procedure, { idTentativa, idAvaliador, parecer }) {
  const status = await emTransacao(async (client) => {
    const { rows } = await client.query(`CALL ${procedure}($1, $2, $3, NULL)`, [
      idTentativa,
      idAvaliador,
      parecer,
    ]);
    return rows[0].p_status; // o INOUT da procedure volta como coluna
  });

  // Só aprovação NOVA muda o ranking. 'ja_aprovada' e 'ajustes' não mexem em pontos.
  let rankingInvalidado = false;
  if (status === 'aprovada') {
    rankingInvalidado = await cache.apagar(CHAVE_RANKING);
  }
  return { status, ranking_invalidado: rankingInvalidado };
}

const aprovarProjeto = (dados) => darParecer('aprovar_projeto', dados);
const pedirAjustes = (dados) => darParecer('pedir_ajustes', dados);

module.exports = { aprovarProjeto, pedirAjustes };
