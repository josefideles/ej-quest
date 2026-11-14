#!/usr/bin/env bash
# Experimento de índice (RNF05, gate G-medida): a MESMA consulta com e sem o índice.
#
#   ./scripts/medir-indice.sh
#
# Roda cada consulta 5 vezes em cada cenário e guarda o EXPLAIN (ANALYZE, BUFFERS) da última.
# Só o índice do experimento é derrubado; chaves e UNIQUE ficam. No fim ele é recriado.
# Paralelismo desligado para a comparação ser justa (um processo só nos dois cenários).
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/_ambiente.sh

saida="docs/resultados/indice.txt"
mkdir -p docs/resultados

psql_db() {
  docker compose exec -T -e PGTZ=America/Maceio -e PGOPTIONS='-c max_parallel_workers_per_gather=0' db psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

CONSULTA_1="SELECT id_tentativa, id_participacao, enviada_em FROM tentativa_avaliacao ORDER BY enviada_em DESC LIMIT 20"
CONSULTA_2="SELECT count(*) FROM tentativa_avaliacao WHERE enviada_em >= timestamptz '2026-11-12 12:00-03' - interval '30 days'"

medir() {
  local titulo="$1" sql="$2"
  echo "### $titulo"
  echo '```sql'; echo "$sql;"; echo '```'
  # 5 execuções: a primeira aquece o cache do Postgres; vale a mediana das 5.
  local tempos=()
  for _ in 1 2 3 4 5; do
    tempos+=("$(psql_db -At -c "EXPLAIN (ANALYZE) $sql" | sed -n 's/^Execution Time: \([0-9.]*\) ms$/\1/p')")
  done
  echo "Tempos (ms): ${tempos[*]}"
  printf 'Mediana: %s ms\n' "$(printf '%s\n' "${tempos[@]}" | sort -g | sed -n 3p)"
  echo '```'
  psql_db -At -c "EXPLAIN (ANALYZE, BUFFERS) $sql"
  echo '```'
  echo
}

{
  echo "# Experimento de índice · $(date '+%d/%m/%Y %H:%M')"
  echo
  echo "Ambiente: $(uname -sr), $(nproc) núcleos, $(free -h | awk 'NR==2 {print $2}') de RAM, PostgreSQL 16 no Docker."
  echo "Carga: $(psql_db -At -c 'SELECT count(*) FROM tentativa_avaliacao') linhas em tentativa_avaliacao (db/05_povoamento.sql, semente 0.42)."
  echo
  echo "## Cenário A: COM idx_tentativa_enviada_em"
  psql_db -q -c "CREATE INDEX IF NOT EXISTS idx_tentativa_enviada_em ON tentativa_avaliacao (enviada_em);"
  medir "Consulta 1: as 20 entregas mais recentes" "$CONSULTA_1"
  medir "Consulta 2: entregas dos últimos 30 dias" "$CONSULTA_2"

  echo "## Cenário B: SEM o índice"
  psql_db -q -c "DROP INDEX idx_tentativa_enviada_em;"
  medir "Consulta 1: as 20 entregas mais recentes" "$CONSULTA_1"
  medir "Consulta 2: entregas dos últimos 30 dias" "$CONSULTA_2"

  psql_db -q -c "CREATE INDEX idx_tentativa_enviada_em ON tentativa_avaliacao (enviada_em);"
  echo "Índice recriado no fim do experimento."
} 2>&1 | tee "$saida"

echo ">> Saída guardada em $saida"
