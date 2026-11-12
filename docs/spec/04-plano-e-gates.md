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

## Fase 3 · sexta, 13/11 · prova

| # | Item | Gate | Status |
|---|---|---|---|
| F3.1 | Medições: índice (EXPLAIN) e cache (mediana e p95) em `docs/resultados/` | G-medida | ✅ adiantada para 12/11 |
| F3.2 | Slides: reaproveitar a AB1 + implementado, demos, números e recorte | G-apresentação | ⏳ |
| F3.3 | Ensaio com o roteiro do manual (cap. 6) | G-apresentação | ⏳ |

## Fase 4 · 15/11 a 25/11 · PW1 (P1)

Login real (bcrypt + sessão), React Router com todas as telas do protótipo, `react-icons`,
formulários com `onChange`/`onClick`, estados de carregamento/erro, README, Trello, deploy.
A spec desta fase será revisada com os materiais de PW1 (padrões do professor para a AB2).

## Ordem de corte se atrasar

F2.5 (telas) → F2.4 → medição de cache (fica a do índice) → API inteira (demo em `psql` +
`redis-cli`). **Nunca cortar:** F1.1, F1.4, F2.1.

## Em aberto

- A AB2 de 13/11 é apresentação do projeto (o vault diz: conceitos + back-end + banco)? Confirmar
  com o professor.
- O professor aceita o quadro do modelo chave-valor como "diagrama de coleções"?
- A disciplina tem regra sobre uso de IA na AB2 individual? (DEC-009)
- Mascote oficial da Rocket: arquivo ainda não localizado; o foguete do protótipo é provisório.
