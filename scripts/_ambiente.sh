# Carregado pelos outros scripts (não rode sozinho).
# Lê o .env se existir; sem ele, usa os mesmos padrões do docker-compose.yml.
set -a
if [ -f .env ]; then . ./.env; fi
set +a
POSTGRES_DB="${POSTGRES_DB:-ej_quest}"
POSTGRES_USER="${POSTGRES_USER:-ej_quest}"
PORTA_API="${PORTA_API:-3000}"
API="${API:-http://localhost:${PORTA_API}}"

# psql dentro do contêiner do banco: não precisa ter PostgreSQL instalado na máquina.
psql_db() {
  docker compose exec -T -e PGTZ=America/Maceio db \
    psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}
