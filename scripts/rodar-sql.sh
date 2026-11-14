#!/usr/bin/env bash
# Roda UM script SQL de db/ no banco do contêiner, para executar as etapas de forma individual.
#
#   ./scripts/rodar-sql.sh 03_views.sql          -> recria só as views (exemplo)
#   ./scripts/recriar-banco.sh sem-povoamento     -> estrutura (01 a 04) sem dados
#   ./scripts/rodar-sql.sh 05_povoamento.sql      -> depois disso, só o povoamento (carga)
#   ./scripts/rodar-sql.sh testes/01_restricoes.sql
#
# O povoamento espera o banco vazio (rode depois de "recriar-banco.sh sem-povoamento").
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/_ambiente.sh

if [ $# -ne 1 ] || [ ! -f "db/$1" ]; then
  echo "Uso: ./scripts/rodar-sql.sh <arquivo dentro de db/>   ex.: 05_povoamento.sql" >&2
  ls db/*.sql db/testes/*.sql | sed 's#^db/#  #' >&2
  exit 1
fi

echo ">> Rodando db/$1"
time psql_db -f "/db/$1"
