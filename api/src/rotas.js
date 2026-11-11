// Controllers: recebem a requisição HTTP, chamam o serviço e devolvem a resposta.
// Regra de negócio NÃO mora aqui; mora em src/servicos/.
const express = require('express');
const { pool } = require('./db');
const { exigirUsuario } = require('./usuario-simulado');
const { obterRanking } = require('./servicos/ranking');
const { aprovarProjeto } = require('./servicos/aprovacao');

const rotas = express.Router();

// Saúde: confirma se a API fala com o Postgres. Útil antes da demo.
rotas.get('/saude', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ api: 'ok', postgres: 'ok' });
  } catch (erro) {
    res.status(503).json({ api: 'ok', postgres: 'indisponível', detalhe: erro.message });
  }
});

// Ranking geral (Cache-Aside). Implementação em servicos/ranking.js.
rotas.get('/ranking', exigirUsuario, async (req, res, next) => {
  try {
    const resultado = await obterRanking();
    res.json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// Aprovação de projeto (transação + procedure + invalidação do cache).
// Corpo esperado: { "parecer": "texto" }
rotas.post('/tentativas/:id/aprovar', exigirUsuario, async (req, res, next) => {
  try {
    const idTentativa = Number(req.params.id);
    if (!Number.isInteger(idTentativa) || idTentativa <= 0) {
      return res.status(400).json({ erro: 'id da tentativa inválido' });
    }
    const parecer = (req.body && req.body.parecer) || '';
    const resultado = await aprovarProjeto({
      idTentativa,
      idAvaliador: req.usuarioId,
      parecer,
    });
    res.json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// Opcional: progresso do membro lendo a vw_progresso_membro.
// Escreva aqui se sobrar tempo na quinta (ver o plano).

module.exports = rotas;
