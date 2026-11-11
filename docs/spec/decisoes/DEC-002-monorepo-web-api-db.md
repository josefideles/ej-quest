# DEC-002 · Um repositório para as duas disciplinas (`web/`, `api/`, `db/`)

- **Contexto:** o front da AB1 de PW1 estava sozinho em `ej-quest-pw1`. BD2 e PW1 precisam do mesmo back-end.
- **Decisão:** monorepo. `web/` = front React; `api/` = back-end Express; `db/` = scripts SQL. Docker Compose sobe banco, cache e API. O repositório deve ser renomeado para `ej-quest` (ação do Fideles no GitHub).
- **Alternativas:** dois repositórios (front e back) — descartado: duplica README, versões e deploy para um desenvolvedor só.
- **Consequências:** o professor de BD2 encontra o banco em `db/`; o de PW1, o front em `web/`. Deploy do front, quando voltar, aponta para `web/`.
- **Quem decidiu:** Fideles · **Data:** 10/11/2026 · **Situação:** vigente
