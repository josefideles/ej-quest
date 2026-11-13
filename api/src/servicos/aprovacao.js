// Parecer do gestor sobre um desafio: aprovar ou pedir ajustes (RF08, RN09, RNF02, RNF03).
// Escrito pelo agente em 12/11/2026 a partir do roteiro do Fideles (DEC-008, DEC-009, DEC-012).
//
// Divisão de trabalho:
//   - o serviço abre e fecha a transação (emTransacao) e sincroniza o Redis DEPOIS do COMMIT;
//   - a procedure trava a participação (FOR UPDATE), confere permissão e estado e grava;
//   - a trigger grava os pontos quando nasce a conclusão.
//
// Depois de uma aprovação NOVA, dois movimentos no Redis (um para cada padrão):
//   1. Cache-Aside: DEL do top 100 (a próxima leitura refaz pelo Postgres)
//   2. Write-Through: ZADD do novo score do membro no placar (Sorted Set)
//
// Perguntas que caem:
//   - Por que os dois vêm DEPOIS do COMMIT? Antes do COMMIT os pontos ainda podem ser
//     desfeitos (ROLLBACK). Se o Redis fosse atualizado antes, poderia mostrar pontos que
//     nunca existiram, ou uma leitura concorrente regravaria a versão sem os pontos novos.
//   - E se o Redis estiver fora? A aprovação já está confirmada no Postgres. A resposta avisa
//     (ranking_invalidado: false, placar_atualizado: false) e a próxima leitura com o Redis
//     de volta reconstrói tudo a partir do SQL.
//   - O gestor clicou duas vezes. O que cada chamada devolve? 'aprovada' e 'ja_aprovada'.
const sql = require('../repositorios/postgres');
const { emTransacao } = require('../transacao');
const { sincronizarAposPontos } = require('./ranking');

async function darParecer(procedure, dados) {
  const status = await emTransacao((client) => sql.chamarParecer(client, procedure, dados));

  // Só aprovação NOVA muda pontos. 'ja_aprovada' e 'ajustes' não mexem no Redis.
  if (status !== 'aprovada') {
    return { status, ranking_invalidado: false, placar_atualizado: false };
  }
  const idMembro = await sql.donoDaTentativa(dados.idTentativa);
  return { status, ...(await sincronizarAposPontos(idMembro)) }; // Cache-Aside + Write-Through
}

const aprovarProjeto = (dados) => darParecer('sp_aprovar_projeto', dados);
const pedirAjustes = (dados) => darParecer('sp_pedir_ajustes', dados);

module.exports = { aprovarProjeto, pedirAjustes };
