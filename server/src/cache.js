// Conexão com o Redis (cache do ranking, banco chave-valor).
//
// Regra do projeto (RNF06): o Redis pode cair e a API continua funcionando pelo PostgreSQL.
// Por isso este arquivo NUNCA deixa um erro do Redis derrubar a requisição:
//   - disableOfflineQueue: com o Redis fora, o comando falha na hora em vez de ficar na fila esperando;
//   - comTimeout: se o Redis demorar mais que TIMEOUT_MS, desistimos e seguimos pelo SQL;
//   - as funções devolvem null / false em caso de falha, e quem chama decide o que fazer.
const { createClient } = require('redis');

const TIMEOUT_MS = 300;

const cliente = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 1000,
    // Tenta reconectar sozinho, esperando no máximo 2 s entre tentativas.
    reconnectStrategy: (tentativas) => Math.min(tentativas * 200, 2000),
  },
});

cliente.on('error', (erro) => {
  // Sem este listener, um erro do Redis derrubaria o processo inteiro.
  console.warn('[redis] indisponível:', erro.message);
});

async function conectar() {
  try {
    await cliente.connect();
    console.log('[redis] conectado');
  } catch (erro) {
    console.warn('[redis] não conectou na subida; a API segue só com o PostgreSQL:', erro.message);
  }
}

function comTimeout(promessa) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error(`timeout de ${TIMEOUT_MS} ms`)), TIMEOUT_MS)
    ),
  ]);
}

// GET chave -> string ou null (null = não existe OU o Redis falhou).
async function ler(chave) {
  try {
    return await comTimeout(cliente.get(chave));
  } catch (erro) {
    console.warn(`[redis] falha ao ler ${chave}:`, erro.message);
    return null;
  }
}

// SET chave valor EX segundos -> true se gravou, false se falhou.
async function gravar(chave, valor, segundos) {
  try {
    await comTimeout(cliente.set(chave, valor, { EX: segundos }));
    return true;
  } catch (erro) {
    console.warn(`[redis] falha ao gravar ${chave}:`, erro.message);
    return false;
  }
}

// DEL chave -> true se o comando rodou, false se falhou.
async function apagar(chave) {
  try {
    await comTimeout(cliente.del(chave));
    return true;
  } catch (erro) {
    console.warn(`[redis] falha ao apagar ${chave}:`, erro.message);
    return false;
  }
}

module.exports = { conectar, ler, gravar, apagar, cliente, comTimeout };
