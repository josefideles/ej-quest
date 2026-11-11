# DEC-008 · Aprovação por procedure com `FOR UPDATE` e pontos por trigger

- **Contexto:** a aprovação é a operação crítica (RN09, RNF02, RNF03): não pode gravar pela metade nem dar ponto duas vezes, mesmo com dois gestores ao mesmo tempo. Decidido na AB1 (seções 4.3 e 4.4).
- **Decisão:** a API abre a transação e chama `aprovar_projeto`, que trava a linha da participação com `SELECT ... FOR UPDATE`, confere de novo o estado e grava resultado e conclusão. A trigger `AFTER INSERT ON conclusao` grava a pontuação. PKs em `conclusao` e `pontuacao` são a segunda barreira.
- **Alternativas:** lógica toda na API (descartada: qualquer outro cliente do banco poderia furar a regra); nível `SERIALIZABLE` (descartado: exige repetir a transação em caso de conflito; o bloqueio explícito é mais simples de explicar e de demonstrar).
- **Consequências:** a demo das duas janelas de `psql` prova a regra sem ferramenta extra.
- **Quem decidiu:** Fideles (AB1) · **Data:** 18/09/2026, confirmada em 10/11/2026 · **Situação:** vigente
