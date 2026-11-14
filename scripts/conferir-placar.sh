#!/usr/bin/env bash
# Confere o placar inteiro do Redis (Sorted Set) contra o ranking do PostgreSQL.
# As duas listas, em ordem, precisam ser iguais (consistência entre SQL e NoSQL).
#
#   ./scripts/conferir-placar.sh        (a API precisa ter montado o placar: GET /ranking/eu)
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/_ambiente.sh

redis_ids=$(docker compose exec -T cache redis-cli ZREVRANGE ranking:placar:v1 0 -1)
sql_ids=$(docker compose exec -T db psql -X -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT id_usuario FROM vw_ranking_consolidado ORDER BY total_pontos DESC, ultima_concessao ASC, id_usuario ASC")

total_redis=$(grep -c . <<<"$redis_ids" || true)
total_sql=$(grep -c . <<<"$sql_ids" || true)
diferencas=$(diff <(echo "$redis_ids") <(echo "$sql_ids") | grep -c '^[<>]' || true)

echo "Participantes no Redis: $total_redis · no PostgreSQL: $total_sql"
echo "Linhas fora de ordem: $diferencas"
if [[ "$diferencas" -eq 0 && "$total_redis" -eq "$total_sql" ]]; then
  echo "OK: o placar do Redis é idêntico ao ranking do PostgreSQL, posição por posição."
else
  echo "ATENÇÃO: há diferença (empate no mesmo segundo ou placar desatualizado). Primeiras:"
  diff <(echo "$redis_ids") <(echo "$sql_ids") | head -10
fi
