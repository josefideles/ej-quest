// Ponto de entrada da API.
const express = require('express');
const rotas = require('./rotas');
const cache = require('./cache');
const { identificar } = require('./autenticacao');

const app = express();

// CORS: o front (React, outra porta ou outro domínio) só consegue chamar a API se ela
// autorizar a origem. É o papel do pacote "cors" usado nas aulas 12 a 14 de PW1; aqui está
// escrito à mão, sem dependência, para ficar visível o que ele faz.
const ORIGENS = (process.env.CORS_ORIGENS || 'http://localhost:5173').split(',');
app.use((req, res, next) => {
  const origem = req.get('Origin');
  if (origem && ORIGENS.includes(origem)) {
    res.set('Access-Control-Allow-Origin', origem);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Usuario-Id');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204); // pré-voo (preflight) do navegador
  next();
});

app.use(express.json());
app.use(identificar); // token (Authorization: Bearer) ou, no modo demonstração, X-Usuario-Id
app.use(rotas);

// Rota que não existe: 404 em JSON (constituição, item 7).
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// Tratador central de erros: erro com status conhecido vira esse status; o resto vira 500
// com detalhe só no log, nunca na resposta.
app.use((erro, req, res, next) => {
  if (erro.status) {
    return res.status(erro.status).json({ erro: erro.message });
  }
  console.error('[api] erro:', erro);
  res.status(500).json({ erro: 'Erro interno' });
});

const porta = Number(process.env.PORTA) || 3000;

cache.conectar(); // não espera: a API sobe mesmo se o Redis estiver fora.
app.listen(porta, () => {
  console.log(`[api] ouvindo na porta ${porta}`);
});
