// Mede a latência de um endpoint: mediana, p95, média, mínimo e máximo.
//
// Uso (com a API de pé):
//   node scripts/medir.js <url> [repeticoes] [--frio]
//
//   --frio  apaga a chave do ranking no Redis antes de CADA chamada (cache sempre vazio).
//           Sem a flag, a 1ª chamada aquece o cache e as outras leem dele (cache quente).
//
// Exemplos:
//   node scripts/medir.js http://localhost:3000/ranking 30 --frio
//   node scripts/medir.js http://localhost:3000/ranking 30
//
// Variáveis: USUARIO_ID (padrão 1), REDIS_URL (padrão redis://localhost:6380, a porta do compose).
// Anote também a máquina usada (processador, memória): o planejamento pede o ambiente registrado.
const { createClient } = require('redis');

const CHAVE_RANKING = 'ranking:geral:v1';

function percentil(ordenados, p) {
  const indice = Math.ceil((p / 100) * ordenados.length) - 1;
  return ordenados[Math.max(0, Math.min(indice, ordenados.length - 1))];
}

async function main() {
  const [url, repeticoesTexto, flag] = process.argv.slice(2);
  if (!url) {
    console.error('Uso: node scripts/medir.js <url> [repeticoes] [--frio]');
    process.exit(1);
  }
  const repeticoes = Number(repeticoesTexto) || 30;
  const frio = flag === '--frio';

  let redis = null;
  if (frio) {
    redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6380' });
    await redis.connect();
  }

  const tempos = [];
  let origens = {};
  for (let i = 0; i < repeticoes; i++) {
    if (redis) await redis.del(CHAVE_RANKING);
    const inicio = performance.now();
    const resposta = await fetch(url, { headers: { 'X-Usuario-Id': process.env.USUARIO_ID || '1' } });
    const corpo = await resposta.json().catch(() => ({}));
    const ms = performance.now() - inicio;
    if (!resposta.ok) {
      console.error(`Chamada ${i + 1} falhou: HTTP ${resposta.status}`, corpo);
      process.exit(1);
    }
    tempos.push(ms);
    const origem = corpo.origem || 'sem campo origem';
    origens[origem] = (origens[origem] || 0) + 1;
  }
  if (redis) await redis.quit();

  const ordenados = [...tempos].sort((a, b) => a - b);
  const media = tempos.reduce((s, t) => s + t, 0) / tempos.length;
  const f = (n) => n.toFixed(2) + ' ms';

  console.log(`URL: ${url}`);
  console.log(`Cenário: ${frio ? 'cache FRIO (DEL antes de cada chamada)' : 'cache QUENTE'}`);
  console.log(`Repetições: ${repeticoes}`);
  console.log(`Origem das respostas: ${JSON.stringify(origens)}`);
  console.log(`Mediana: ${f(percentil(ordenados, 50))}`);
  console.log(`p95:     ${f(percentil(ordenados, 95))}`);
  console.log(`Média:   ${f(media)}`);
  console.log(`Mínimo:  ${f(ordenados[0])}   Máximo: ${f(ordenados[ordenados.length - 1])}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
