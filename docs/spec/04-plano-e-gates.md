# 04 · Plano, gates e "Em aberto"

> Desenvolvimento em par: Fideles + Claude. Cada item fecha com o gate e a evidência guardada em
> `docs/resultados/` ou no commit. O capítulo do manual do dia acompanha o item.

## Fluxo de cada item

```
item do plano (RF/RN)  →  capítulo do manual lido  →  implementação em par (banco → API → tela)
→  evidência (psql, curl, EXPLAIN, print)  →  gate  →  commit  →  manual atualizado ("Como ficou")
```

## Gates

| Gate | Pergunta | Evidência mínima |
|---|---|---|
| G-dados | O schema sobe do zero e se defende? | `recriar-banco.sh` roda 2× sem erro; inserts proibidos falham (duplicado, órfão, CHECK) |
| G-regra | A regra crítica é atômica e única? | Teste das duas janelas; falha provocada antes do COMMIT não deixa rastro |
| G-carga | Há volume para medir? | `count(*)` de `tentativa_avaliacao` ≥ 100.000; ranking com pontos |
| G-api | A API cumpre o contrato e sobrevive ao Redis fora? | `curl` de cada rota P0; `docker compose stop cache` e as rotas seguem |
| G-medida | Os números existem e são honestos? | `EXPLAIN (ANALYZE)` com/sem índice; mediana e p95 com cache frio/quente, ambiente anotado |
| G-tela | As telas tratam carregando, vazio, erro e permissão? | Roteiro manual no celular e no desktop |
| G-apresentação | Dá para explicar cada escolha? | Roteiro ensaiado; respostas do guia de perguntas do manual |

## Fase 0 · terça, 10/11/2026 (noite) ✅

| # | Item | Status |
|---|---|---|
| F0.1 | Repositório em monorepo (`web/`, `api/`, `db/`), Compose subindo | ✅ |
| F0.2 | Protótipo no Figma (13 telas, componentes, tokens, mapa de rastreabilidade) | ✅ |
| F0.3 | Spec SDD (`docs/spec/`) e decisões DEC-001 a DEC-008 | ✅ |
| F0.4 | Manual: capítulos 0 (visão e arquitetura) e 1 (ambiente e modelagem) | ✅ |

## Fase 1 · quarta, 11/11 · o banco (P0) · manual cap. 2 e 3

| # | Item | Camada | Requisitos | Gate |
|---|---|---|---|---|
| F1.1 | DDL das 16 tabelas com restrições (`db/01_schema.sql`) | dados | RF04, RNF01, RN01, RN04, RN09, RN17 | G-dados |
| F1.2 | Índice candidato (`db/02_indices.sql`) | dados | RNF05 | G-dados |
| F1.3 | Views de ranking e progresso (`db/03_views.sql`) | dados | RF09, RF11, RN11, RN12 | G-dados |
| F1.4 | Trigger de pontuação e procedure de aprovação (`db/04_regras.sql`) | dados | RF08, RN09, RNF02, RNF03 | G-regra |

## Fase 2 · quinta, 12/11 · carga e API (P0) · manual cap. 4 e 5

| # | Item | Camada | Requisitos | Gate |
|---|---|---|---|---|
| F2.1 | Povoamento ≥ 100 mil tentativas (`db/05_povoamento.sql`) | dados | especificação BD2, RNF10 | G-carga |
| F2.2 | `GET /ranking` com Cache-Aside | API | RF11, RNF06 | G-api |
| F2.3 | `POST /tentativas/:id/aprovar` e `/ajustes` (transação + invalidação) | API | RF08, RNF02, RNF03 | G-api |
| F2.4 | `POST /avaliacoes/:id/tentativas` e `GET /matriculas/:id/progresso` | API | RF07, RF09, RN08 | G-api |
| F2.5 | **Só se F1 e F2.1-F2.3 estiverem verdes:** telas 07 Ranking, 10 Avaliar entrega e 02 Jornada (leitura) em `web/` consumindo a API | tela | RF08, RF09, RF11 | G-tela |

## Fase 3 · sexta, 13/11 (12h-14h e 18h-18h30) · prova · manual cap. 6

| # | Item | Gate |
|---|---|---|
| F3.1 | Medições: índice (EXPLAIN) e cache (mediana e p95) em `docs/resultados/` | G-medida |
| F3.2 | Slides: reaproveitar a AB1 + implementado, demos, números e recorte | G-apresentação |
| F3.3 | Ensaio com o roteiro do manual | G-apresentação |

## Fase 4 · 15/11 a 25/11 · PW1 (P1)

Login real (bcrypt + sessão), React Router com todas as telas do protótipo, `react-icons`,
formulários com `onChange`/`onClick`, estados de carregamento/erro, README, Trello, deploy.

## Ordem de corte se atrasar

F2.5 (telas) → F2.4 → medição de cache (fica a do índice) → API inteira (demo em `psql` +
`redis-cli`). **Nunca cortar:** F1.1, F1.4, F2.1.

## Em aberto

- A AB2 de 13/11 é apresentação do projeto (o vault diz: conceitos + back-end + banco)? Confirmar
  com o professor.
- O professor aceita o quadro do modelo chave-valor como "diagrama de coleções"?
- Mascote oficial da Rocket: arquivo ainda não localizado; o foguete do protótipo é provisório.
