# DEC-003 · SQL escrito à mão com `pg`, sem ORM

- **Contexto:** a avaliação de BD2 cobra explicar transações, bloqueios, views, procedures e índices. Um ORM (Prisma, Sequelize) esconderia exatamente isso. O planejamento da AB1 já dizia que a biblioteca não deve ocultar as consultas.
- **Decisão:** usar `pg` (node-postgres) com SQL explícito e parametrizado. Esquema em scripts `db/*.sql` rodados em ordem.
- **Consequências:** mais código de consulta, mas cada linha é explicável. Sem migrações automáticas: `recriar-banco.sh` recria tudo (aceitável num demonstrador local).
- **Quem decidiu:** Fideles · **Data:** 10/11/2026 · **Situação:** vigente
