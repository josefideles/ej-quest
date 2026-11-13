#!/usr/bin/env bash
# Gate G-api: cada rota P0 com curl, caminho feliz e infeliz, e o teste de queda do Redis.
#
#   docker compose up -d --build && ./scripts/testar-api.sh
#
# GRAVA dados (uma aprovação e um pedido de ajustes). Para voltar à carga: ./scripts/recriar-banco.sh
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/_ambiente.sh

saida="docs/resultados/testes-api.txt"
mkdir -p docs/resultados
resp=$(mktemp)

sql() { docker compose exec -T db psql -X -At -F ' ' -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"; }

# Posição de um usuário calculada SÓ pelo SQL (a referência para conferir o Redis).
pos_sql() { sql "SELECT coalesce((SELECT posicao FROM (SELECT id_usuario, row_number() OVER (ORDER BY total_pontos DESC, ultima_concessao ASC, id_usuario ASC) AS posicao FROM vw_ranking_consolidado) r WHERE id_usuario = $1)::text, 'sem_pontos')"; }
# Posição pela API: tira "posicao" e "origem" do JSON só com grep e sed (sem jq nem Python).
pos_api() {
  local j; j=$(curl -s "$API/ranking/eu" -H "X-Usuario-Id: $1")
  local p; p=$(echo "$j" | grep -o '"posicao":[0-9]*' | sed 's/.*://'); p=${p:-sem_pontos}
  local o; o=$(echo "$j" | grep -o '"origem":"[^"]*"' | sed 's/"origem":"//; s/"$//')
  echo "$p $o"
}

# chama MÉTODO URL USUÁRIO [CORPO] → imprime "HTTP <status>" e o começo do JSON da resposta
chama() {
  local metodo="$1" url="$2" usuario="$3" corpo="${4:-}"
  local args=(-s -o "$resp" -w '%{http_code}' -X "$metodo" "$API$url" -H 'Content-Type: application/json')
  [[ -n "$usuario" ]] && args+=(-H "X-Usuario-Id: $usuario")
  [[ -n "$corpo" ]] && args+=(-d "$corpo")
  local status; status=$(curl "${args[@]}")
  echo "> $metodo $url  (X-Usuario-Id: ${usuario:-nenhum})"
  echo "  HTTP $status  $(head -c 260 "$resp")$( [ "$(wc -c < "$resp")" -gt 260 ] && echo ' ...')"
}

# chamat MÉTODO URL TOKEN [CORPO] → igual a chama, mas com Authorization: Bearer (login real)
chamat() {
  local metodo="$1" url="$2" token="$3" corpo="${4:-}"
  local args=(-s -o "$resp" -w '%{http_code}' -X "$metodo" "$API$url" -H 'Content-Type: application/json' -H "Authorization: Bearer $token")
  [[ -n "$corpo" ]] && args+=(-d "$corpo")
  local status; status=$(curl "${args[@]}")
  echo "> $metodo $url  (token de login)"
  echo "  HTTP $status  $(head -c 260 "$resp")$( [ "$(wc -c < "$resp")" -gt 260 ] && echo ' ...')"
}
login() { curl -s -X POST "$API/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"senha\":\"$2\"}" | grep -o '"token":"[^"]*"' | sed 's/"token":"//; s/"$//'; }

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
echo "## Login (RF01): senha conferida no banco (bcrypt), token assinado"
chama POST /login "" '{"email":"usuario2@ejquest.test","senha":"errada"}'
chama POST /login "" '{"email":"usuario2@ejquest.test"}'
TOKEN2=$(login usuario2@ejquest.test ejquest123)
echo "  token do gestor 2 recebido: ${TOKEN2:0:24}..."
chamat GET /eu "$TOKEN2"
chamat GET /eu "${TOKEN2}x"
echo "  Desligado perde o acesso: usuário 50 (ativo = false na carga)"
chama POST /login "" '{"email":"usuario50@ejquest.test","senha":"ejquest123"}'
echo
echo "## Fluxo de estudo (RF05, RF06): trilha, quiz sem gabarito, correção no servidor"
read -r MEMBRO QUIZ TRILHA <<<"$(sql "SELECT m.id_usuario, pa.id_avaliacao, m.id_trilha FROM participacao_avaliacao pa JOIN avaliacao a USING (id_avaliacao) JOIN matricula m USING (id_matricula) JOIN usuario u USING (id_usuario) WHERE a.tipo = 'quiz' AND u.ativo AND NOT EXISTS (SELECT 1 FROM conclusao c WHERE c.id_participacao = pa.id_participacao) ORDER BY pa.id_participacao LIMIT 1")"
CERTAS=$(sql "SELECT json_agg(json_build_object('id_questao', q.id_questao, 'alternativa', al.numero) ORDER BY q.ordem) FROM questao q JOIN alternativa al ON al.id_questao = q.id_questao AND al.correta WHERE q.id_avaliacao = $QUIZ")
ERRADAS=$(sql "SELECT json_agg(json_build_object('id_questao', q.id_questao, 'alternativa', (q.id_questao % 4) + 1 + CASE WHEN (q.id_questao % 4) + 1 = 4 THEN -3 ELSE 1 END) ORDER BY q.ordem) FROM questao q WHERE q.id_avaliacao = $QUIZ")
UMA=$(sql "SELECT json_agg(json_build_object('id_questao', q.id_questao, 'alternativa', 1)) FROM questao q WHERE q.id_avaliacao = $QUIZ AND q.ordem = 1")
echo "Membro $MEMBRO, quiz $QUIZ (ainda não aprovado), trilha $TRILHA."
TOKENM=$(login "usuario$MEMBRO@ejquest.test" ejquest123)
chamat GET "/trilhas/$TRILHA" "$TOKENM"
chamat GET "/avaliacoes/$QUIZ" "$TOKENM"
echo "  O gabarito não sai do servidor: ocorrências de \"correta\" na resposta = $(grep -o correta "$resp" | wc -l | tr -d ' ')"
read -r P_ANTES _ <<<"$(pos_api "$MEMBRO")"
chamat POST "/avaliacoes/$QUIZ/respostas" "$TOKENM" "{\"respostas\":$UMA}"
chamat POST "/avaliacoes/$QUIZ/respostas" "$TOKENM" "{\"respostas\":$ERRADAS}"
chamat POST "/avaliacoes/$QUIZ/respostas" "$TOKENM" "{\"respostas\":$CERTAS}"
chamat POST "/avaliacoes/$QUIZ/respostas" "$TOKENM" "{\"respostas\":$CERTAS}"
read -r P_DEPOIS origem <<<"$(pos_api "$MEMBRO")"
echo "  Quiz aprovado vira 20 pontos (trigger) e o placar acompanha (Write-Through): posição $P_ANTES → $P_DEPOIS ($origem); SQL=$(pos_sql "$MEMBRO")"
OUTRO=$(sql "SELECT u.id_usuario FROM usuario u WHERE u.ativo AND u.id_usuario > 4 AND NOT EXISTS (SELECT 1 FROM matricula m WHERE m.id_usuario = u.id_usuario AND m.id_trilha = $TRILHA) ORDER BY 1 LIMIT 1")
chama GET "/trilhas/$TRILHA" "$OUTRO"
echo
echo "## Ranking (Cache-Aside): 1ª leitura vem do Postgres, 2ª do Redis"
docker compose exec -T cache redis-cli DEL ranking:geral:v1 >/dev/null
chama GET /ranking 2
chama GET /ranking 2
echo
echo "## Placar (Sorted Set): posição de quem está logado"
docker compose exec -T cache redis-cli DEL ranking:placar:v1 >/dev/null
chama GET /ranking/eu "$DONO1"
chama GET /ranking/eu "$DONO1"
echo "  Conferência Redis x SQL (5 usuários; as duas colunas precisam ser iguais):"
for u in 1121 2178 500 3333 "$DONO1"; do
  read -r p_api origem <<<"$(pos_api "$u")"
  echo "    usuário $u: Redis=$p_api ($origem)  SQL=$(pos_sql "$u")"
done
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
echo "  (depois da aprovação nova, o top 100 foi invalidado: a próxima leitura vem do Postgres)"
chama GET /ranking 2
echo "  Write-Through: a posição do membro $DONO1 mudou no placar sem reconstruir nada:"
read -r p_api origem <<<"$(pos_api "$DONO1")"
echo "    usuário $DONO1: Redis=$p_api ($origem)  SQL=$(pos_sql "$DONO1")"
echo
echo "## Portfólio (RF10): o desafio aprovado aparece com link e parecer"
chama GET /eu/portfolio "$DONO1"
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
chama GET /ranking/eu "$DONO1"
chama POST "/tentativas/$T3/aprovar" 2 '{"parecer":"aprovo com o Redis fora"}'
echo "  (aprovação confirmada no Postgres; ranking_invalidado e placar_atualizado false: o Redis não recebeu nada)"
docker compose start cache >/dev/null 2>&1
sleep 3
echo "  (Redis de volta)"
chama GET /saude ""
chama GET /ranking 2
chama GET /ranking 2
echo "  O Redis voltou VAZIO (sem disco): o placar é reconstruído na primeira leitura e inclui a aprovação feita com ele fora:"
read -r T3DONO <<<"$(sql "SELECT m.id_usuario FROM tentativa_avaliacao t JOIN participacao_avaliacao pa USING (id_participacao) JOIN matricula m USING (id_matricula) WHERE t.id_tentativa = $T3")"
read -r p_api origem <<<"$(pos_api "$T3DONO")"
echo "    usuário $T3DONO: Redis=$p_api ($origem)  SQL=$(pos_sql "$T3DONO")"
echo
echo "## Rota inexistente"
chama GET /nao-existe 2
} 2>&1 | tee "$saida"
rm -f "$resp"
echo ">> Saída guardada em $saida"
