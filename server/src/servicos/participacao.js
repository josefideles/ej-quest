// Envio de desafio, progresso do membro e fila do gestor (RF07, RF09, RF08, RN06 a RN08, RN11).
// Escrito pelo agente em 12/11/2026 (DEC-009). O SQL está em repositorios/postgres.js.
const sql = require('../repositorios/postgres');
const { emTransacao } = require('../transacao');
const { ErroHttp } = require('../erros');

// Membro envia link e descrição do desafio. As regras (matrícula, quizzes antes, um envio
// aguardando por vez, nada depois de aprovado) estão na procedure sp_enviar_projeto.
async function enviarProjeto(dados) {
  return emTransacao((client) => sql.chamarEnvio(client, dados));
}

// Quem pode ver o progresso de uma matrícula: o próprio membro, o gestor geral ou um gestor
// da diretoria da trilha. Conferido no servidor (constituição, item 3).
async function obterProgresso({ idMatricula, idUsuario }) {
  const p = await sql.progressoDaMatricula(idMatricula, idUsuario);
  if (!p) throw new ErroHttp(404, 'Matrícula não encontrada');
  if (!p.pode_ver) throw new ErroHttp(403, 'Sem permissão para ver esta matrícula');

  const proxima = await sql.proximaAvaliacao(p.id_trilha, idMatricula);
  return {
    id_matricula: Number(p.id_matricula),
    trilha: p.trilha,
    exigidas: p.avaliacoes_exigidas,
    concluidas: p.avaliacoes_concluidas,
    percentual: Number(p.percentual),
    proxima: proxima ? { ...proxima, id_avaliacao: Number(proxima.id_avaliacao) } : null, // null = trilha concluída (RN11)
  };
}

// Fila de entregas aguardando parecer, só do escopo do gestor, das mais antigas primeiro.
async function obterFila({ idUsuario, limite = 50 }) {
  const linhas = await sql.filaDoGestor(idUsuario, limite);
  return linhas.map((r) => ({ ...r, id_tentativa: Number(r.id_tentativa), id_membro: Number(r.id_membro) }));
}

// Painel do gestor (tela 11). Quem não gere nenhuma diretoria recebe 403: o painel não é dele.
async function obterResumoGestao({ idUsuario }) {
  const resumo = await sql.resumoDoGestor(idUsuario);
  return { ...resumo, membros: resumo.membros.map((m) => ({ ...m, id_usuario: Number(m.id_usuario) })) };
}

module.exports = { enviarProjeto, obterProgresso, obterFila, obterResumoGestao };
