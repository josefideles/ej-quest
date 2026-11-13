// Controllers: recebem a requisição HTTP, validam o formato, chamam o serviço e respondem.
// Regra de negócio NÃO mora aqui; mora em src/servicos/ e nas procedures do banco.
// Lista de rotas com o que cada uma faz: README.md, seção "Endpoints".
const express = require('express');
const { pool } = require('./db');
const cache = require('./cache');
const { exigirUsuario } = require('./autenticacao');
const { obterRanking, obterMinhaPosicao } = require('./servicos/ranking');
const { aprovarProjeto, pedirAjustes } = require('./servicos/aprovacao');
const { enviarProjeto, obterProgresso, obterFila, obterResumoGestao } = require('./servicos/participacao');
const estudo = require('./servicos/estudo');

const rotas = express.Router();

// Converte o :id da URL e recusa lixo antes de chegar ao banco.
function idDaUrl(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ erro: 'id inválido na URL' });
    return null;
  }
  return id;
}

// Envolve um handler async: qualquer erro vai para o tratador central do index.js.
const rota = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Saúde: Postgres e Redis. Útil antes da demo e no teste de queda do cache.
rotas.get('/saude', async (req, res) => {
  const redis = cache.cliente.isReady ? 'ok' : 'indisponível';
  try {
    await pool.query('SELECT 1');
    res.json({ api: 'ok', postgres: 'ok', redis });
  } catch (erro) {
    res.status(503).json({ api: 'ok', postgres: 'indisponível', redis });
  }
});

// RF01 · login: e-mail e senha → token assinado (válido por 8 h)
rotas.post('/login', rota(async (req, res) => {
  const { email, senha } = req.body || {};
  res.json(await estudo.entrar({ email, senha }));
}));

// RF01 · encerrar sessão. O token não fica guardado no servidor (é assinado, não armazenado):
// sair é o front apagar o token. A rota existe para o front ter um ponto único de saída.
rotas.post('/logout', (req, res) => res.status(204).end());

// Quem sou eu: perfil, papéis por diretoria e matrículas
rotas.get('/eu', exigirUsuario, rota(async (req, res) => {
  res.json(await estudo.meuPerfil(req.usuarioId));
}));

// RF10 · portfólio interno: desafios aprovados, com link e parecer
rotas.get('/eu/portfolio', exigirUsuario, rota(async (req, res) => {
  res.json(await estudo.portfolio(req.usuarioId));
}));

// RF05 · trilha com módulos, lições e avaliações (e o status de cada uma para quem pediu)
rotas.get('/trilhas/:id', exigirUsuario, rota(async (req, res) => {
  const idTrilha = idDaUrl(req, res);
  if (!idTrilha) return;
  res.json(await estudo.trilha({ idTrilha, idUsuario: req.usuarioId }));
}));

// RF06 · quiz para responder (sem gabarito)
rotas.get('/avaliacoes/:id', exigirUsuario, rota(async (req, res) => {
  const idAvaliacao = idDaUrl(req, res);
  if (!idAvaliacao) return;
  res.json(await estudo.quiz({ idAvaliacao, idUsuario: req.usuarioId }));
}));

// RF06 · enviar as respostas do quiz. Corpo: { "respostas": [{ "id_questao": 1, "alternativa": 3 }, ...] }
rotas.post('/avaliacoes/:id/respostas', exigirUsuario, rota(async (req, res) => {
  const idAvaliacao = idDaUrl(req, res);
  if (!idAvaliacao) return;
  const respostas = req.body && req.body.respostas;
  res.status(201).json(await estudo.responderQuiz({ idUsuario: req.usuarioId, idAvaliacao, respostas }));
}));

// RF11 · ranking geral, top 100 (Cache-Aside)
rotas.get('/ranking', exigirUsuario, rota(async (req, res) => {
  res.json(await obterRanking());
}));

// RF11 · posição de quem está logado (Sorted Set no Redis, Write-Through, DEC-012)
rotas.get('/ranking/eu', exigirUsuario, rota(async (req, res) => {
  res.json(await obterMinhaPosicao(req.usuarioId));
}));

// RF08 · gestor aprova um desafio. Corpo: { "parecer": "texto" }
rotas.post('/tentativas/:id/aprovar', exigirUsuario, rota(async (req, res) => {
  const idTentativa = idDaUrl(req, res);
  if (!idTentativa) return;
  const parecer = (req.body && req.body.parecer) || '';
  res.json(await aprovarProjeto({ idTentativa, idAvaliador: req.usuarioId, parecer }));
}));

// RF08 · gestor pede ajustes. Corpo: { "parecer": "texto" } (obrigatório)
rotas.post('/tentativas/:id/ajustes', exigirUsuario, rota(async (req, res) => {
  const idTentativa = idDaUrl(req, res);
  if (!idTentativa) return;
  const parecer = (req.body && req.body.parecer) || '';
  res.json(await pedirAjustes({ idTentativa, idAvaliador: req.usuarioId, parecer }));
}));

// RF07 · membro envia o desafio. Corpo: { "link_projeto": "https://...", "descricao_entrega": "..." }
rotas.post('/avaliacoes/:id/tentativas', exigirUsuario, rota(async (req, res) => {
  const idAvaliacao = idDaUrl(req, res);
  if (!idAvaliacao) return;
  const { link_projeto: link, descricao_entrega: descricao } = req.body || {};
  const criada = await enviarProjeto({ idUsuario: req.usuarioId, idAvaliacao, link, descricao });
  res.status(201).json(criada);
}));

// RF07 · histórico das minhas entregas nesta avaliação (tela 06, "Suas entregas")
rotas.get('/avaliacoes/:id/minhas-tentativas', exigirUsuario, rota(async (req, res) => {
  const idAvaliacao = idDaUrl(req, res);
  if (!idAvaliacao) return;
  res.json(await estudo.minhasTentativas({ idAvaliacao, idUsuario: req.usuarioId }));
}));

// RF09 · progresso de uma matrícula e a próxima atividade
rotas.get('/matriculas/:id/progresso', exigirUsuario, rota(async (req, res) => {
  const idMatricula = idDaUrl(req, res);
  if (!idMatricula) return;
  res.json(await obterProgresso({ idMatricula, idUsuario: req.usuarioId }));
}));

// RF08 · fila de entregas aguardando parecer, no escopo do gestor (tela 10)
// ?limite=N (1 a 1000, padrão 50): a tela de avaliação usa um limite maior para achar a entrega.
rotas.get('/fila', exigirUsuario, rota(async (req, res) => {
  const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 1000);
  res.json({ entregas: await obterFila({ idUsuario: req.usuarioId, limite }) });
}));

// RF12 · painel do gestor: números e acompanhamento dos membros no escopo dele (tela 11)
rotas.get('/gestao/resumo', exigirUsuario, rota(async (req, res) => {
  res.json(await obterResumoGestao({ idUsuario: req.usuarioId }));
}));

module.exports = rotas;
