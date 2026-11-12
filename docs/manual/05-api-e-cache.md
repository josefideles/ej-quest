# Capítulo 5 · O back-end: Express, pool, transação na API, Redis e Cache-Aside

> **Objetivo:** seguir uma requisição da URL até o banco e de volta, e explicar o cache.
>
> **Tempo de leitura:** ~30 min · **Arquivos:** `api/src/` · **Evidência:**
> `docs/resultados/testes-api.txt` (`./scripts/testar-api.sh`)

---

## 5.1 O caminho de uma requisição

```
POST /tentativas/126087/aprovar   (X-Usuario-Id: 2, corpo { "parecer": "Ótimo trabalho" })
  index.js         express.json() lê o corpo · usuario-simulado.js lê o cabeçalho
  rotas.js         valida o :id, chama o serviço           ← controller: sem regra de negócio
  servicos/aprovacao.js   emTransacao → CALL aprovar_projeto → COMMIT → DEL no Redis
  transacao.js     BEGIN / COMMIT / ROLLBACK numa conexão reservada
  erros.js         SQLSTATE EJ403 → HTTP 403 etc.
← 200 { "status": "aprovada", "ranking_invalidado": true }
```

| Arquivo | Papel |
|---|---|
| `db.js` | Pool de conexões com o PostgreSQL |
| `cache.js` | Cliente Redis que **nunca** derruba a requisição (timeout de 300 ms, falha devolve null) |
| `transacao.js` | `emTransacao(fn)`: BEGIN, fn, COMMIT; erro → ROLLBACK; sempre `release()` |
| `erros.js` | Traduz erro do banco em HTTP sem vazar detalhe interno |
| `usuario-simulado.js` | Identificação por cabeçalho (DEC-004: **não é segurança**, é recorte) |
| `rotas.js` | As 7 rotas do contrato (`docs/spec/03-arquitetura.md`) |
| `servicos/` | `ranking.js`, `aprovacao.js`, `participacao.js` |

## 5.2 Pool e transação

🧠 **Pool:** um conjunto de conexões abertas e reaproveitadas. Abrir conexão é caro.

🧠 `pool.query(...)` pega **qualquer** conexão livre. Serve para leitura simples. Para transação,
não: o BEGIN poderia ir por uma conexão e o CALL por outra. Por isso `emTransacao` faz
`pool.connect()` e usa **o mesmo** `client` do BEGIN ao COMMIT, e devolve no `finally`.

🧠 **SQL injection:** a API nunca concatena valor no texto do SQL. `client.query('CALL
aprovar_projeto($1, $2, $3, NULL)', [id, avaliador, parecer])` manda os valores separados, e o
banco nunca interpreta o parecer como comando.

## 5.3 Cache-Aside no ranking (DEC-005)

```
GET /ranking
  1. GET ranking:geral:v1 no Redis (desiste em 300 ms)
  2. achou → devolve { origem: "cache", ... }
  3. não achou → SELECT na vw_ranking_consolidado (top 100, ORDER BY da RN12)
              → SET ranking:geral:v1 <json> EX 60     (se falhar, segue)
              → devolve { origem: "postgres", ... }
Aprovação nova → COMMIT → DEL ranking:geral:v1 → a próxima leitura refaz pelo Postgres
```

**Os números** (`docs/resultados/cache.txt`, 50 chamadas cada):

| Cenário | Mediana | p95 |
|---|---|---|
| Cache frio (sempre Postgres) | 43,0 ms | 58,4 ms |
| Cache quente (Redis) | **3,0 ms** | **5,4 ms** |

🧠 **p95:** 95% das chamadas foram mais rápidas que esse valor. Mostra o "quase pior caso", que a
média esconde.

🧠 **Por que o DEL vem depois do COMMIT?** Se viesse antes, outra requisição poderia ler o
Postgres **antes** do COMMIT (sem os pontos novos) e gravar essa versão velha no Redis por 60 s.

🧠 **Por que string JSON e não Sorted Set?** (DEC-005) A RN12 desempata por "última concessão" e
por id. O Sorted Set ordena por um único número. Daria para compor o score, mas a string JSON é a
resposta pronta da API, refeita do SQL em uma consulta. O Sorted Set fica como evolução.

## 5.4 Redis fora (RNF06)

`docker compose stop cache` e:

- `/saude` → `"redis": "indisponível"`;
- `/ranking` → 200, `origem: "postgres"`;
- aprovação → 200, `ranking_invalidado: false` (a aprovação está no Postgres; o DEL não chegou).

Ao religar o Redis, o cliente reconecta sozinho, e a segunda leitura já vem do cache.

❓ **"Mas e se o Redis voltar com um ranking velho?"** → O Redis roda sem disco
(`--save "" --appendonly no`): ao reiniciar, volta vazio. E todo valor tem TTL de 60 s.

## 5.5 ❓ O que o professor pode perguntar

- **"Onde está a regra de negócio?"** → Na procedure (banco) e no serviço (API). Nunca no controller
  nem na tela.
- **"Por que sem ORM?"** → DEC-003: o ORM esconderia transação e bloqueio, que é o que a disciplina avalia.
- **"O cache pode mostrar valor errado?"** → Atrasado em até 60 s, nunca inventado.
- **"Por que top 100?"** → A tela mostra o top 100. Guardar o ranking inteiro (5.876 pessoas) no
  Redis deixaria cada leitura do cache mais pesada sem uso.
- **"Isso é seguro?"** → A identificação por cabeçalho não é. Recorte declarado (DEC-004); login
  real entra em PW1. As consultas são parametrizadas e a permissão é checada no servidor.

✍️ **Minhas notas**
>
