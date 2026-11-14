// Tradução dos erros do banco para HTTP.
//
// As procedures levantam erros com SQLSTATE próprio (db/04_regras.sql):
//   EJ400 → 400   EJ403 → 403   EJ404 → 404   EJ409 → 409
// Erros de restrição (PK, UNIQUE, FK, CHECK) também viram 409 ou 400: são a "segunda barreira"
// agindo, e a API responde sem expor detalhe interno (constituição, item 7).

const POR_SQLSTATE = {
  EJ400: 400,
  EJ403: 403,
  EJ404: 404,
  EJ409: 409,
  23505: 409, // unique_violation: duplicidade barrada pelo banco
  23503: 409, // foreign_key_violation: referência a algo que não existe ou ainda tem filhos
  23514: 400, // check_violation: valor proibido
};

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function traduzirErroDoBanco(erro) {
  const status = POR_SQLSTATE[erro.code];
  if (!status) return erro; // erro inesperado: segue como 500 no handler do index.js
  // Mensagem das nossas procedures é para o usuário; a das restrições é genérica.
  const mensagem = erro.code.startsWith('EJ') ? erro.message : 'Operação recusada pelas regras do banco';
  return new ErroHttp(status, mensagem);
}

module.exports = { ErroHttp, traduzirErroDoBanco };
