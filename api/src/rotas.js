// Controllers: recebem a requisição HTTP, validam o formato, chamam o serviço e respondem.
// Regra de negócio NÃO mora aqui; mora em src/servicos/ e nas procedures do banco.
// Contrato: docs/spec/03-arquitetura.md, seção "Contrato da API".
const express = require('express');
const { pool } = require('./db');
const cache = require('./cache');
const { exigirUsuario } = require('./usuario-simulado');
const { obterRanking } = require('./servicos/ranking');
const { aprovarProjeto, pedirAjustes } = require('./servicos/aprovacao');
const { enviarProjeto, obterProgresso, obterFila } = require('./servicos/participacao');

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

// RF11 · ranking geral (Cache-Aside)
rotas.get('/ranking', exigirUsuario, rota(async (req, res) => {
  res.json(await obterRanking());
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

// RF09 · progresso de uma matrícula e a próxima atividade
rotas.get('/matriculas/:id/progresso', exigirUsuario, rota(async (req, res) => {
  const idMatricula = idDaUrl(req, res);
  if (!idMatricula) return;
  res.json(await obterProgresso({ idMatricula, idUsuario: req.usuarioId }));
}));

// RF08 · fila de entregas aguardando parecer, no escopo do gestor (tela 10)
rotas.get('/fila', exigirUsuario, rota(async (req, res) => {
  res.json({ entregas: await obterFila({ idUsuario: req.usuarioId }) });
}));

module.exports = rotas;
