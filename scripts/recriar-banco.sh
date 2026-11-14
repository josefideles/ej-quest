#!/usr/bin/env bash
# Apaga TODAS as tabelas do banco local e roda os scripts de db/ em ordem.
# Use sempre que mudar um .sql: o banco volta a um estado conhecido.
#
#   ./scripts/recriar-banco.sh                 -> schema + índices + views + regras + povoamento
#   ./scripts/recriar-banco.sh sem-povoamento  -> pula o 05 (mais rápido enquanto escreve o schema)
#
# Para no primeiro erro (ON_ERROR_STOP) e mostra o arquivo e a linha.
set -euo pipefail
cd "$(dirname "$0")/.."

. scripts/_ambiente.sh

psql_db() {
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

echo ">> Zerando o schema public"
psql_db -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

for arquivo in 01_schema.sql 02_indices.sql 03_views.sql 04_regras.sql 05_povoamento.sql; do
  if [[ "${1:-}" == "sem-povoamento" && "$arquivo" == "05_povoamento.sql" ]]; then
    echo ">> Pulando $arquivo"
    continue
  fi
  echo ">> Rodando db/$arquivo"
  psql_db -f "/db/$arquivo"
done

echo ">> Pronto. Tabelas:"
psql_db -c "\dt"
