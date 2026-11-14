// Mede um endpoint: latência (mediana, p95, média, mínimo, máximo) e vazão (requisições/s).
//
// Uso (com a API de pé):
//   node scripts/medir.js <url> [repeticoes] [--frio] [--concorrencia N]
//
//   --frio           apaga a chave do ranking no Redis antes de CADA chamada (cache sempre vazio).
//                    Sem a flag, a 1ª chamada aquece o cache e as outras leem dele (cache quente).
//                    Só faz sentido com concorrência 1 (com várias ao mesmo tempo, uma aquece a outra).
//   --concorrencia N N chamadas em voo ao mesmo tempo (padrão 1). Com N > 1, o número que importa
//                    é a VAZÃO (throughput): quantas requisições por segundo a API aguenta.
//
// Variáveis: USUARIO_ID (padrão 1; "aleatorio" sorteia um membro de 5 a 6000 por chamada),
//            REDIS_URL (padrão redis://localhost:6380, a porta do compose).
//
// Exemplos:
//   node scripts/medir.js http://localhost:3000/ranking 50 --frio
//   node scripts/medir.js http://localhost:3000/ranking 2000 --concorrencia 20
//   USUARIO_ID=aleatorio node scripts/medir.js http://localhost:3000/ranking/eu 2000 --concorrencia 20
// Para o cenário "sem cache" da vazão: docker compose stop cache (a API segue pelo Postgres).
const { createClient } = require('redis');

const CHAVE_RANKING = 'ranking:geral:v1';

function percentil(ordenados, p) {
  const indice = Math.ceil((p / 100) * ordenados.length) - 1;
  return ordenados[Math.max(0, Math.min(indice, ordenados.length - 1))];
}

function usuario() {
  const v = process.env.USUARIO_ID || '1';
  return v === 'aleatorio' ? String(5 + Math.floor(Math.random() * 5996)) : v;
}

async function main() {
  const args = process.argv.slice(2);
  const url = args[0];
  if (!url) {
    console.error('Uso: node scripts/medir.js <url> [repeticoes] [--frio] [--concorrencia N]');
    process.exit(1);
  }
  const repeticoes = Number(args[1]) || 30;
  const frio = args.includes('--frio');
  const iConc = args.indexOf('--concorrencia');
  const concorrencia = iConc >= 0 ? Number(args[iConc + 1]) || 1 : 1;

  let redis = null;
  if (frio) {
    redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6380' });
    await redis.connect();
  }

  const tempos = [];
  const origens = {};
  let falhas = 0;
  let proxima = 0;

  async function umaChamada() {
    if (redis) await redis.del(CHAVE_RANKING);
    const inicio = performance.now();
    const resposta = await fetch(url, { headers: { 'X-Usuario-Id': usuario() } });
    const corpo = await resposta.json().catch(() => ({}));
    tempos.push(performance.now() - inicio);
    if (!resposta.ok) falhas++;
    const origem = corpo.origem || `HTTP ${resposta.status}`;
    origens[origem] = (origens[origem] || 0) + 1;
  }

  // "Trabalhadores": cada um faz chamadas em sequência até acabar a cota total.
  async function trabalhador() {
    while (proxima < repeticoes) {
      proxima++;
      await umaChamada();
    }
  }

  const inicioTotal = performance.now();
  await Promise.all(Array.from({ length: concorrencia }, trabalhador));
  const segundos = (performance.now() - inicioTotal) / 1000;
  if (redis) await redis.quit();

  const ordenados = [...tempos].sort((a, b) => a - b);
  const media = tempos.reduce((s, t) => s + t, 0) / tempos.length;
  const f = (n) => n.toFixed(2) + ' ms';

  console.log(`URL: ${url}`);
  console.log(`Cenário: ${frio ? 'cache FRIO (DEL antes de cada chamada)' : 'cache como estiver (quente se o Redis estiver de pé)'}`);
  console.log(`Repetições: ${repeticoes} · concorrência: ${concorrencia} · falhas: ${falhas}`);
  console.log(`Origem das respostas: ${JSON.stringify(origens)}`);
  console.log(`Vazão:   ${(repeticoes / segundos).toFixed(0)} requisições/s (${segundos.toFixed(2)} s no total)`);
  console.log(`Mediana: ${f(percentil(ordenados, 50))}`);
  console.log(`p95:     ${f(percentil(ordenados, 95))}`);
  console.log(`Média:   ${f(media)}`);
  console.log(`Mínimo:  ${f(ordenados[0])}   Máximo: ${f(ordenados[ordenados.length - 1])}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
