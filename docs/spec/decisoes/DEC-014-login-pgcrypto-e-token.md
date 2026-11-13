# DEC-014 · Login com bcrypt no banco (pgcrypto) e token assinado na API; fluxo de estudo pela API

- **Contexto:** a AB1 (documento final de 18/09/2026) define que a AB2 está pronta quando "o fluxo de estudo, submissão, avaliação e consulta funcionar" e as "permissões estiverem verificadas", com RF01 (autenticar e encerrar sessão), RF05 (conteúdo) e RF06 (quiz corrigido no servidor). Em 12/11/2026 a API cobria submissão, avaliação e consulta, com identificação simulada (DEC-004).
- **Decisão:**
  - **RF01:** senha guardada como hash bcrypt gerado no próprio PostgreSQL pela extensão `pgcrypto` (`crypt` + `gen_salt('bf')`); a função `fn_autenticar` confere a senha no banco. A API devolve um token assinado com HMAC-SHA256 (mesma ideia do JWT, com o módulo `crypto` do Node, sem dependência nova), válido por 8 h. A cada requisição com token, a API confere assinatura, validade e se o usuário continua ativo (RN17). Encerrar sessão = o cliente descarta o token.
  - **RF05 e RF06:** `GET /trilhas/:id` (módulos, lições e status das avaliações), `GET /avaliacoes/:id` (quiz sem gabarito) e `POST /avaliacoes/:id/respostas`, com a procedure `sp_responder_quiz` corrigindo no servidor e gerando conclusão e pontos quando aprovado.
  - O cabeçalho `X-Usuario-Id` continua aceito só em modo demonstração (`PERMITIR_CABECALHO_USUARIO=1`, padrão local), para os scripts de teste e de medição. Substitui a DEC-004 nesse ponto.
- **Alternativas:** `bcrypt` e `jsonwebtoken` do npm (descartadas: duas dependências novas para algo que o PostgreSQL e o Node já fazem); sessão guardada no Redis (descartada: com o Redis fora, ninguém conseguiria entrar, contrariando a RNF06).
- **Limites declarados:** sem lista de revogação de token (logout só no cliente); sem limite de tentativas de login; modo demonstração precisa ser desligado num ambiente real.
- **Evidência:** `docs/resultados/testes-api.txt`, seções "Login" e "Fluxo de estudo".
- **Quem decidiu:** agente, para cumprir a definição de pronto da AB1 (DEC-009) · **Data:** 12/11/2026 · **Situação:** vigente
