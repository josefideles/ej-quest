// Conexão com o PostgreSQL (fonte oficial dos dados).
//
// Pool = um conjunto de conexões abertas e reaproveitadas. Abrir conexão com o banco é caro;
// o pool evita abrir uma nova a cada requisição.
//
// Dois jeitos de usar, e a diferença cai na apresentação:
//   pool.query(sql, params)   -> pega QUALQUER conexão livre, roda UM comando e devolve.
//                                Bom para leituras simples.
//   const client = await pool.connect()
//                             -> reserva UMA conexão só para você. Obrigatório em transação:
//                                BEGIN, os comandos e o COMMIT precisam ir pela MESMA conexão.
//                                Sempre termine com client.release() (num finally).
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.on('error', (erro) => {
  console.error('[postgres] erro numa conexão ociosa do pool:', erro.message);
});

module.exports = { pool };
