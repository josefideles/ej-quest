#!/usr/bin/env bash
# Roda os testes do banco e guarda a saída em docs/resultados/ (evidência dos gates).
#
#   ./scripts/testar-banco.sh
#
# 1. G-dados: inserts proibidos falham (db/testes/01_restricoes.sql, com ROLLBACK)
# 2. G-regra: permissão, atomicidade e idempotência (db/testes/02_regras.sql, com ROLLBACK)
# 3. G-regra: concorrência REAL com duas sessões ao mesmo tempo (as "duas janelas").
#    Este passo GRAVA uma aprovação no banco. Para voltar ao estado da carga:
#    ./scripts/recriar-banco.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

saida="docs/resultados/testes-banco.txt"
mkdir -p docs/resultados

psql_db() {
  docker compose exec -T -e PGTZ=America/Maceio db psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

{
  echo "# Testes do banco · $(date '+%d/%m/%Y %H:%M')"
  echo
  echo "## 1. Restrições (G-dados)"
  psql_db -f /db/testes/01_restricoes.sql
  echo
  echo "## 2. Regras (G-regra)"
  psql_db -f /db/testes/02_regras.sql
  echo
  echo "## 3. Concorrência: dois gestores aprovam a MESMA entrega ao mesmo tempo (RNF03)"

  arq_a=$(mktemp); arq_b=$(mktemp)
  linha=$(psql_db -At -F ' ' -c "SELECT id_tentativa, id_participacao, id_diretoria + 1 FROM vw_fila_avaliacao ORDER BY id_tentativa DESC LIMIT 1")
  read -r t p gestor <<<"$linha"
  echo "Entrega: tentativa $t (participação $p). Aprovadores: gestor $gestor (sessão A) e gestor geral 1 (sessão B)."
  echo

  # Sessão A: aprova e SEGURA a transação aberta por 3 s antes do COMMIT.
  psql_db -At -c "BEGIN;
    CALL aprovar_projeto($t, $gestor, 'aprovado pela sessão A');
    SELECT 'A: ' || to_char(clock_timestamp(), 'HH24:MI:SS.MS') || ' aprovou e segura o bloqueio por 3 s';
    SELECT pg_sleep(3);
    COMMIT;
    SELECT 'A: ' || to_char(clock_timestamp(), 'HH24:MI:SS.MS') || ' COMMIT';" > "$arq_a" &
  sleep 1

  # Sessão B: chega 1 s depois. Tem que ESPERAR o bloqueio e então ver que já foi aprovada.
  psql_db -At -c "SELECT 'B: ' || to_char(clock_timestamp(), 'HH24:MI:SS.MS') || ' chegou e pediu a aprovação';
    CALL aprovar_projeto($t, 1, 'aprovado pela sessão B');
    SELECT 'B: ' || to_char(clock_timestamp(), 'HH24:MI:SS.MS') || ' destravou';" > "$arq_b"
  wait

  echo "Sessão A (a linha 'aprovada' é o p_status devolvido pela procedure):"
  sed 's/^/  /' "$arq_a"
  echo "Sessão B (repare no horário: ela esperou o COMMIT de A e recebeu 'ja_aprovada'):"
  sed 's/^/  /' "$arq_b"
  rm -f "$arq_a" "$arq_b"
  echo
  echo "Resultado final no banco (esperado: 1, 1, 1):"
  psql_db -c "SELECT (SELECT count(*) FROM resultado_tentativa WHERE id_tentativa = $t) AS resultados,
                     (SELECT count(*) FROM conclusao WHERE id_participacao = $p) AS conclusoes,
                     (SELECT count(*) FROM pontuacao WHERE id_participacao = $p) AS pontuacoes,
                     (SELECT id_avaliador FROM resultado_tentativa WHERE id_tentativa = $t) AS quem_aprovou;"
} 2>&1 | tee "$saida"

echo ">> Saída guardada em $saida"
