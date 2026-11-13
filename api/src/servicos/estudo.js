// Fluxo de estudo do membro: perfil, trilha com lições, quiz e envio de respostas (RF01, RF05, RF06).
// Escrito pelo agente em 12/11/2026 (DEC-009, DEC-014). O SQL está em repositorios/postgres.js.
const sql = require('../repositorios/postgres');
const { emTransacao } = require('../transacao');
const { ErroHttp } = require('../erros');
const { gerarToken } = require('../autenticacao');
const { sincronizarAposPontos } = require('./ranking');

async function entrar({ email, senha }) {
  if (!email || !senha) throw new ErroHttp(400, 'Informe e-mail e senha');
  const id = await sql.autenticar(email, senha);
  // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails existem.
  if (!id) throw new ErroHttp(401, 'E-mail ou senha incorretos');
  return { ...gerarToken(id), usuario: await sql.perfil(id) };
}

async function meuPerfil(idUsuario) {
  const p = await sql.perfil(idUsuario);
  if (!p) throw new ErroHttp(404, 'Usuário não encontrado');
  return { ...p, id_usuario: Number(p.id_usuario) };
}

async function trilha({ idTrilha, idUsuario }) {
  const t = await sql.trilhaParaUsuario(idTrilha, idUsuario);
  if (!t) throw new ErroHttp(404, 'Trilha não encontrada');
  if (!t.pode_ver) throw new ErroHttp(403, 'Você não está matriculado nesta trilha');
  const { pode_ver, ...resto } = t;
  return { ...resto, id_trilha: Number(t.id_trilha), id_matricula: t.id_matricula && Number(t.id_matricula) };
}

async function quiz({ idAvaliacao, idUsuario }) {
  const q = await sql.quizParaResponder(idAvaliacao, idUsuario);
  if (!q) throw new ErroHttp(404, 'Avaliação não encontrada');
  if (!q.pode_ver) throw new ErroHttp(403, 'Você não está matriculado nesta trilha');
  const { pode_ver, ...resto } = q;
  return { ...resto, id_avaliacao: Number(q.id_avaliacao), percentual_minimo: q.percentual_minimo && Number(q.percentual_minimo) };
}

// A correção e as regras (matrícula, uma resposta por questão, nada depois de aprovado) estão
// na procedure sp_responder_quiz. Se aprovou, sincroniza o Redis depois do COMMIT.
async function responderQuiz({ idUsuario, idAvaliacao, respostas }) {
  if (!Array.isArray(respostas)) throw new ErroHttp(400, 'Envie "respostas" como lista de { id_questao, alternativa }');
  const r = await emTransacao((client) => sql.chamarQuiz(client, { idUsuario, idAvaliacao, respostas }));
  const sync = r.decisao === 'aprovada'
    ? await sincronizarAposPontos(idUsuario)
    : { ranking_invalidado: false, placar_atualizado: false };
  return { ...r, ...sync };
}

// RF10 · portfólio: desafios aprovados de quem está logado
async function portfolio(idUsuario) {
  return { projetos: await sql.portfolio(idUsuario) };
}

module.exports = { entrar, meuPerfil, trilha, quiz, responderQuiz, portfolio };
