// Executa uma função dentro de UMA transação, numa conexão reservada do pool.
//
// Por que não pool.query('BEGIN')? Porque pool.query pega QUALQUER conexão livre: o BEGIN
// poderia ir por uma conexão e o CALL por outra, e a transação não valeria nada.
// Aqui a mesma conexão (client) faz BEGIN, os comandos e o COMMIT.
const { pool } = require('./db');
const { traduzirErroDoBanco } = require('./erros');

async function emTransacao(trabalho) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await trabalho(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    // Desfaz tudo o que a transação fez: nada fica gravado pela metade (RNF02).
    await client.query('ROLLBACK').catch(() => {});
    throw traduzirErroDoBanco(erro);
  } finally {
    client.release(); // devolve a conexão ao pool, SEMPRE (até quando dá erro)
  }
}

module.exports = { emTransacao };
