// Ponto de entrada da API.
const express = require('express');
const rotas = require('./rotas');
const cache = require('./cache');
const { usuarioSimulado } = require('./usuario-simulado');

const app = express();
app.use(express.json());
app.use(usuarioSimulado);
app.use(rotas);

// Erro "ainda não implementado" (os serviços que você vai escrever começam assim).
// Qualquer outro erro vira 500 com a mensagem no log.
app.use((erro, req, res, next) => {
  if (erro.naoImplementado) {
    return res.status(501).json({ erro: erro.message });
  }
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
