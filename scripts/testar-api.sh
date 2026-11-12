#!/usr/bin/env bash
# Gate G-api: cada rota P0 com curl, caminho feliz e infeliz, e o teste de queda do Redis.
#
#   docker compose up -d --build && ./scripts/testar-api.sh
#
# GRAVA dados (uma aprovação e um pedido de ajustes). Para voltar à carga: ./scripts/recriar-banco.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

API="${API:-http://localhost:3000}"
saida="docs/resultados/testes-api.txt"
mkdir -p docs/resultados

sql() { docker compose exec -T db psql -X -At -F ' ' -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"; }

# chama MÉTODO URL USUÁRIO [CORPO] → imprime "HTTP <status>" e o JSON (resumido se for grande)
chama() {
  local metodo="$1" url="$2" usuario="$3" corpo="${4:-}"
  local args=(-s -o /tmp/ejq_resp.json -w '%{http_code}' -X "$metodo" "$API$url" -H 'Content-Type: application/json')
  [[ -n "$usuario" ]] && args+=(-H "X-Usuario-Id: $usuario")
  [[ -n "$corpo" ]] && args+=(-d "$corpo")
  local status; status=$(curl "${args[@]}")
  echo "> $metodo $url  (X-Usuario-Id: ${usuario:-nenhum})"
  echo "  HTTP $status  $(python3 -c '
import json,sys
d=json.load(open("/tmp/ejq_resp.json"))
if isinstance(d,dict) and "participantes" in d:
    d={**d,"participantes":d["participantes"][:3]+["..."]}
if isinstance(d,dict) and "entregas" in d:
    d={"entregas":d["entregas"][:1]+["... (%d no total)"%len(d["entregas"])]}
print(json.dumps(d,ensure_ascii=False))' 2>/dev/null || cat /tmp/ejq_resp.json)"
}

{
echo "# Testes da API · $(date '+%d/%m/%Y %H:%M')"
echo

# Dados para o teste: duas entregas aguardando parecer na diretoria 1 (gestor 2).
read -r T1 DONO1 <<<"$(sql "SELECT id_tentativa, id_membro FROM vw_fila_avaliacao WHERE id_diretoria = 1 ORDER BY id_tentativa LIMIT 1")"
read -r T2 <<<"$(sql "SELECT id_tentativa FROM vw_fila_avaliacao WHERE id_diretoria = 1 ORDER BY id_tentativa OFFSET 1 LIMIT 1")"
read -r T3 <<<"$(sql "SELECT id_tentativa FROM vw_fila_avaliacao WHERE id_diretoria = 1 ORDER BY id_tentativa OFFSET 2 LIMIT 1")"
read -r AVAL1 <<<"$(sql "SELECT id_avaliacao FROM vw_fila_avaliacao WHERE id_tentativa = $T1")"
read -r MAT1 <<<"$(sql "SELECT pa.id_matricula FROM participacao_avaliacao pa JOIN tentativa_avaliacao t USING (id_participacao) WHERE t.id_tentativa = $T1")"
echo "Entregas usadas: $T1 (membro $DONO1, avaliação $AVAL1, matrícula $MAT1), $T2 e $T3. Gestor de Projetos: 2."
echo

echo "## Saúde"
chama GET /saude ""
echo
echo "## Ranking (Cache-Aside): 1ª leitura vem do Postgres, 2ª do Redis"
docker compose exec -T cache redis-cli DEL ranking:geral:v1 >/dev/null
chama GET /ranking 2
chama GET /ranking 2
echo
echo "## Sem identificação"
chama GET /ranking ""
echo
echo "## Fila do gestor de Projetos"
chama GET /fila 2
echo
echo "## Aprovação: autoaprovação, gestor de fora, aprovação válida e clique duplo"
chama POST "/tentativas/$T1/aprovar" "$DONO1" '{"parecer":"aprovo a minha"}'
chama POST "/tentativas/$T1/aprovar" 3 '{"parecer":"não sou de Projetos"}'
chama POST "/tentativas/$T1/aprovar" 2 '{"parecer":"Ótimo trabalho"}'
chama POST "/tentativas/$T1/aprovar" 2 '{"parecer":"Ótimo trabalho"}'
echo "  (depois da aprovação nova, o ranking foi invalidado: a próxima leitura vem do Postgres)"
chama GET /ranking 2
echo
echo "## Ajustes: sem parecer e com parecer"
chama POST "/tentativas/$T2/ajustes" 2 '{"parecer":""}'
chama POST "/tentativas/$T2/ajustes" 2 '{"parecer":"Explique as decisões de layout no README"}'
echo
echo "## Envio do desafio: depois de aprovado (RN07) e link inválido"
chama POST "/avaliacoes/$AVAL1/tentativas" "$DONO1" '{"link_projeto":"https://github.com/x/y","descricao_entrega":"de novo"}'
chama POST "/avaliacoes/$AVAL1/tentativas" "$DONO1" '{"link_projeto":"github.com/sem-protocolo"}'
echo
echo "## Progresso: o próprio membro, um estranho e matrícula inexistente"
chama GET "/matriculas/$MAT1/progresso" "$DONO1"
chama GET "/matriculas/$MAT1/progresso" 9
chama GET "/matriculas/99999999/progresso" 1
echo
echo "## URL inválida"
chama POST /tentativas/abc/aprovar 2 '{}'
echo
echo "## Queda do Redis (RNF06): o sistema segue pelo Postgres"
docker compose stop cache >/dev/null 2>&1
sleep 1
chama GET /saude ""
chama GET /ranking 2
chama POST "/tentativas/$T3/aprovar" 2 '{"parecer":"aprovo com o Redis fora"}'
echo "  (aprovação confirmada no Postgres; ranking_invalidado: false porque o DEL não chegou ao Redis)"
docker compose start cache >/dev/null 2>&1
sleep 3
echo "  (Redis de volta)"
chama GET /saude ""
chama GET /ranking 2
chama GET /ranking 2
} 2>&1 | tee "$saida"
rm -f /tmp/ejq_resp.json
echo ">> Saída guardada em $saida"
