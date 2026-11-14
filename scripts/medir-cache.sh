#!/usr/bin/env bash
# Experimento de cache (RNF05, gate G-medida): latência e vazão COM e SEM o Redis.
#
#   ./scripts/medir-cache.sh
#
# Cenários:
#   1. GET /ranking (top 100) · latência com cache frio x quente (sequencial)
#   2. GET /ranking (top 100) · vazão com 20 clientes ao mesmo tempo, Redis de pé x Redis parado
#   3. GET /ranking/eu (posição) · vazão com 20 clientes, Sorted Set x SQL (Redis parado)
# "Redis parado" = docker compose stop cache: a API responde só pelo PostgreSQL (RNF06).
set -euo pipefail
cd "$(dirname "$0")/.."

. scripts/_ambiente.sh
saida="docs/resultados/cache.txt"
mkdir -p docs/resultados

# O medidor roda DENTRO do contêiner da API (já tem Node): não precisa de Node na sua máquina.
# Lá dentro a API é localhost:3000 e o Redis é cache:6379.
medir() { docker compose exec -T -e USUARIO_ID="${USUARIO_ID:-1}" api node scripts/medir.js "$@"; }
API_INTERNA="http://localhost:3000"

{
  echo "# Experimento de cache · $(date '+%d/%m/%Y %H:%M')"
  echo
  echo "Ambiente: $(uname -sr), $(nproc) núcleos, $(free -h | awk 'NR==2 {print $2}') de RAM; API (Node $(docker compose exec -T api node -v)), PostgreSQL 16 e Redis 7 em Docker na mesma máquina. Medidor dentro do contêiner da API."
  echo
  echo "## 1. Latência do top 100 (50 chamadas, uma por vez)"
  echo '```'; medir "$API_INTERNA/ranking" 50 --frio; echo '```'
  echo '```'; medir "$API_INTERNA/ranking" 50; echo '```'
  echo
  echo "## 2. Vazão do top 100 (2.000 chamadas, 20 ao mesmo tempo)"
  echo "### Com Redis (Cache-Aside)"
  echo '```'; medir "$API_INTERNA/ranking" 2000 --concorrencia 20; echo '```'
  docker compose stop cache >/dev/null 2>&1; sleep 1
  echo "### Sem Redis (só PostgreSQL)"
  echo '```'; medir "$API_INTERNA/ranking" 2000 --concorrencia 20; echo '```'
  docker compose start cache >/dev/null 2>&1; sleep 3
  echo
  echo "## 3. Vazão da posição do usuário (2.000 chamadas, 20 ao mesmo tempo, usuários sorteados)"
  curl -s "$API/ranking/eu" -H 'X-Usuario-Id: 8' >/dev/null   # monta o placar
  echo "### Com Redis (Sorted Set, ZREVRANK)"
  echo '```'; USUARIO_ID=aleatorio medir "$API_INTERNA/ranking/eu" 2000 --concorrencia 20; echo '```'
  docker compose stop cache >/dev/null 2>&1; sleep 1
  echo "### Sem Redis (row_number() sobre o ranking inteiro no PostgreSQL)"
  echo '```'; USUARIO_ID=aleatorio medir "$API_INTERNA/ranking/eu" 2000 --concorrencia 20; echo '```'
  docker compose start cache >/dev/null 2>&1; sleep 3
} 2>&1 | tee "$saida"

echo ">> Saída guardada em $saida"
