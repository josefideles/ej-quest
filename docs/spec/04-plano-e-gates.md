# 04 · Plano, gates e "Em aberto"

> Desde 12/11/2026 (DEC-009): o agente implementa pela spec; o Fideles estuda, roda os testes e
> apresenta. Cada item fecha com o gate e a evidência guardada em `docs/resultados/`.

## Fluxo de cada item

```
item do plano (RF/RN)  →  implementação (banco → API → tela)  →  evidência (psql, curl, EXPLAIN)
→  gate  →  manual atualizado  →  Fideles estuda e explica em voz alta  →  commit
```

## Gates

| Gate | Pergunta | Evidência mínima | Status |
|---|---|---|---|
| G-dados | O schema sobe do zero e se defende? | `recriar-banco.sh` roda 2× sem erro; inserts proibidos falham | ✅ 13 casos recusados (`testes-banco.txt`) |
| G-regra | A regra crítica é atômica e única? | Teste das duas janelas; falha antes do COMMIT não deixa rastro | ✅ 9 casos + duas sessões reais (`testes-banco.txt`) |
| G-carga | Há volume para medir? | `count(*)` de `tentativa_avaliacao` ≥ 100.000; ranking com pontos | ✅ 140.574 tentativas, 34.101 pontuações |
| G-api | A API cumpre o contrato e sobrevive ao Redis fora? | `curl` de cada rota P0; `docker compose stop cache` | ✅ `testes-api.txt` |
| G-medida | Os números existem e são honestos? | `EXPLAIN (ANALYZE)` com/sem índice; mediana e p95 com cache frio/quente | ✅ `indice.txt`, `cache.txt` |
| G-tela | As telas tratam carregando, vazio, erro e permissão? | Roteiro manual no celular e no desktop | ⏳ fase de PW1 |
| G-apresentação | Dá para explicar cada escolha? | Roteiro ensaiado; respostas do guia de perguntas do manual | ⏳ Fideles, 13/11 |

## Fase 0 · terça, 10/11/2026 (noite) ✅

| # | Item | Status |
|---|---|---|
| F0.1 | Repositório em monorepo (`web/`, `api/`, `db/`), Compose subindo | ✅ |
| F0.2 | Protótipo no Figma (13 telas, componentes, tokens, mapa de rastreabilidade) | ✅ |
| F0.3 | Spec SDD (`docs/spec/`) e decisões DEC-001 a DEC-008 | ✅ |
| F0.4 | Manual: capítulos 0 (visão e arquitetura) e 1 (ambiente e modelagem) | ✅ |

## Fase 1 · o banco (P0) · feita em 12/11/2026 ✅

| # | Item | Requisitos | Status |
|---|---|---|---|
| F1.1 | DDL das 16 tabelas com restrições (`db/01_schema.sql`) | RF04, RNF01, RN01, RN04, RN05, RN09, RN17 | ✅ |
| F1.2 | Índice do experimento (`db/02_indices.sql`) | RNF05 | ✅ trocado após medição (DEC-010) |
| F1.3 | Views de ranking, progresso e fila (`db/03_views.sql`) | RF08, RF09, RF11, RN11, RN12 | ✅ |
| F1.4 | Trigger de pontuação e procedures de aprovação, ajustes e envio (`db/04_regras.sql`) | RF07, RF08, RN06 a RN09, RNF02, RNF03 | ✅ |

## Fase 2 · carga e API (P0) · feita em 12/11/2026 ✅

| # | Item | Requisitos | Status |
|---|---|---|---|
| F2.1 | Povoamento ≥ 100 mil tentativas, reprodutível (`db/05_povoamento.sql`) | especificação BD2, RNF10 | ✅ |
| F2.2 | `GET /ranking` com Cache-Aside | RF11, RNF06 | ✅ |
| F2.3 | `POST /tentativas/:id/aprovar` e `/ajustes` (transação + invalidação) | RF08, RNF02, RNF03 | ✅ |
| F2.4 | `POST /avaliacoes/:id/tentativas`, `GET /matriculas/:id/progresso` e `GET /fila` | RF07, RF08, RF09, RN08 | ✅ |
| F2.5 | Telas 07 Ranking, 10 Avaliar entrega e 02 Jornada consumindo a API | RF08, RF09, RF11 | ⏳ movida para a fase de PW1 (aguarda os materiais da disciplina) |

## Fase 2b · revisão pelos materiais das disciplinas · 12/11/2026 ✅

| # | Item | Origem | Status |
|---|---|---|---|
| F2b.1 | Prefixos `sp_`/`vw_`/`trg_` e RN18 por trigger `BEFORE UPDATE OR DELETE` | Aula 5 de BD2 (DEC-011) | ✅ |
| F2b.2 | Placar em Sorted Set com Write-Through e `GET /ranking/eu` | Especificação de BD2, tema 8 (DEC-012) | ✅ |
| F2b.3 | Camada de repositórios (SQL e NoSQL) e CORS | Especificação de BD2 3.1; aulas 12 a 14 de PW1 (DEC-013) | ✅ |
| F2b.4 | Vazão (req/s) com e sem Redis | Entregável 3 de BD2 ("throughput") | ✅ `cache.txt` |
| F2b.5 | Documento de arquitetura e modelagem (ER, chave-valor, justificativa) | Entregável 1 de BD2 | ✅ `docs/arquitetura-e-modelagem.md` |
| F2b.6 | Manual: revisão geral pelos materiais e roteiro da videoaula | Pedido do Fideles | ✅ |

## Fase 3 · sexta, 13/11 · prova

| # | Item | Gate | Status |
|---|---|---|---|
| F3.1 | Medições: índice (EXPLAIN) e cache (mediana e p95) em `docs/resultados/` | G-medida | ✅ adiantada para 12/11 |
| F3.2 | Slides: reaproveitar a AB1 + implementado, demos, números e recorte | G-apresentação | ⏳ |
| F3.3 | Ensaio com o roteiro do manual (cap. 6) | G-apresentação | ⏳ |

## Fase 4 · 15/11 a 25/11 · PW1 (P1)

Checklist da Tabela 1 da AB2 de PW1 em `02-requisitos.md`. Ordem proposta (banco → API → tela):

| # | Item | Conceito de PW1 |
|---|---|---|
| F4.1 | Estrutura de páginas e rotas: Jornada, Ranking, Perfil, Avaliar (gestor) | `react-router-dom` (aula 8) |
| F4.2 | Componentes com props: topo, navegação, nó da trilha, card de entrega, linha do ranking | Componentes e props (aulas 6 e 7) |
| F4.3 | Ícones na navegação e nos status | `react-icons` (aula 9) |
| F4.4 | Leitura da API: ranking, minha posição, progresso, fila | `axios` + `useEffect` + `.map()` (aulas 11 e 14) |
| F4.5 | Escrita na API: enviar desafio, aprovar, pedir ajustes | `onChange`, `onClick`, `useState` (aulas 10 e 13) |
| F4.6 | Estados de carregando, vazio, erro e sem permissão | Renderização condicional (aula 11) |
| F4.7 | Login real (bcrypt + sessão) no lugar do `X-Usuario-Id` | RF01, RNF04 |
| F4.8 | README, Trello e deploy online | Seções 2.3 a 2.5 da AB2 de PW1 |

O professor usa CRA, `yarn` e MySQL nas aulas. O projeto usa Vite, `npm` e PostgreSQL: o
conceito avaliado (React, rotas, estado, conexão com banco) é o mesmo. Justificar na apresentação:
o CRA foi descontinuado pelo próprio time do React, e o PostgreSQL é exigência de BD2.

## Ordem de corte se atrasar

F2.5 (telas) → F2.4 → medição de cache (fica a do índice) → API inteira (demo em `psql` +
`redis-cli`). **Nunca cortar:** F1.1, F1.4, F2.1.

## Em aberto

- A AB2 de 13/11 é apresentação do projeto (o vault diz: conceitos + back-end + banco)? Confirmar
  com o professor.
- O professor aceita o quadro do modelo chave-valor como "diagrama de coleções"?
- A disciplina tem regra sobre uso de IA na AB2 individual? (DEC-009)
- PW1 pede equipe de 3 a 6 pessoas e gestão no Trello. O EJ Quest de PW1 é individual ou em equipe?
- PW1 pede o "sistema final online". Onde hospedar API, PostgreSQL e Redis mantendo o custo zero
  (RNF11)? Opções a avaliar: planos gratuitos de hospedagem de Node, PostgreSQL e Redis, ou
  apresentar rodando localmente se o professor aceitar.
- Datas da AB2 de PW1: 18/11 e 25/11/2026 (o que é entregue em cada uma?).
- Mascote oficial da Rocket: arquivo ainda não localizado; o foguete do protótipo é provisório.
