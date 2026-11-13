# Revisão geral · o EJ Quest à luz dos materiais de BD2 e PW1

> **Por que este capítulo existe:** em 12/11/2026 o projeto foi revisado contra tudo o que os
> professores passaram: a especificação de BD2, as aulas 2, 5 e 6 de BD2 (com quizzes e o script
> de laboratório) e as aulas 1 a 14 e a descrição da AB2 de PW1. Em vez de reescrever os
> capítulos 0 a 6, este capítulo junta **o que mudou**, **como cada conceito das aulas aparece no
> projeto** e **os números atualizados**. Se algo aqui discordar de um capítulo anterior, vale este.
>
> **Tempo de leitura:** ~45 min · **Leia depois** dos caps. 1 e 3, **antes** do cap. 6.

---

## R.1 O que mudou no projeto, e por quê

| Mudança | De onde veio | Arquivo | Decisão |
|---|---|---|---|
| Procedures com prefixo `sp_` (`sp_aprovar_projeto`...) | Aula 5: "use prefixos `vw_`, `sp_`, `trg_`" | `db/04_regras.sql` | DEC-011 |
| RN18 garantida por trigger `BEFORE UPDATE OR DELETE` | Aula 5: triggers com `OLD`, `BEFORE`, integridade | `db/04_regras.sql` | DEC-011 |
| Placar em **Sorted Set** com **Write-Through** e `GET /ranking/eu` | Especificação de BD2, tema 8: "Redis (Sorted Sets): placar de líderes" | `api/src/repositorios/placar-redis.js` | DEC-012 |
| Camada **Repository** (SQL e NoSQL) separada dos serviços | Especificação de BD2, seção 3.1 (Controller, Service, Repository) | `api/src/repositorios/` | DEC-013 |
| CORS e 404 em JSON | Aulas 12 a 14 de PW1 (servidor com `cors`) | `api/src/index.js` | DEC-013 |
| Medição de **vazão** (req/s) com e sem Redis | Entregável 3 de BD2: "teste de consistência e throughput" | `scripts/medir-cache.sh` | - |
| Conferência completa Redis x SQL | Mesmo entregável: consistência | `scripts/conferir-placar.sh` | - |
| Documento de arquitetura e modelagem | Entregável 1 de BD2 | `docs/arquitetura-e-modelagem.md` | - |

O banco **não mudou de estrutura**: continuam 16 tabelas. Mudaram nomes de procedures e entraram
3 triggers.

## R.2 Os dois padrões de sincronização (o ponto alto da AB2)

A especificação pede "demonstração de padrões de sincronização/consistência entre SQL e NoSQL
(ex.: Write-Through, Cache-Aside, Event-Driven Sync)". O projeto agora mostra **dois**:

| | **Cache-Aside** (top 100) | **Write-Through** (placar) |
|---|---|---|
| Chave | `ranking:geral:v1` (string JSON) | `ranking:placar:v1` (Sorted Set) |
| Quem enche o Redis | A **leitura** que não achou a chave | A **escrita**: logo depois do COMMIT da aprovação |
| O que a aprovação faz | `DEL` (apaga; a próxima leitura refaz) | `ZADD` (atualiza o score do membro) |
| Vantagem | Simples; o Redis só guarda o que alguém pediu | O placar está sempre pronto e atualizado |
| Risco | A primeira leitura depois do DEL é lenta | Se o Redis estiver fora na hora, o placar fica velho → por isso TTL de 10 min e reconstrução |

🧠 **Sorted Set** é um conjunto de membros únicos, cada um com uma nota (*score*), que o Redis
mantém **sempre ordenado**. Comandos: `ZADD` (inserir/atualizar), `ZREVRANK` (posição, do maior
para o menor), `ZSCORE`, `ZCARD`. A posição sai em **O(log N)**: com 5.876 pessoas, uns 13 passos.
No SQL, a mesma pergunta precisa numerar o ranking inteiro (`row_number()`) a cada chamada.

🧠 **Como a RN12 cabe num número só:**

```
score = total_pontos × 10.000.000.000 + (10.000.000.000 − segundos da última concessão)
```

Mais pontos sempre ganham (a parte da esquerda domina). Com pontos iguais, quem recebeu a última
concessão **antes** tem um número de segundos menor, logo um score maior: fica na frente. É
exatamente "total desc, última concessão asc".

🔧 **Três cuidados que estão no código** (`placar-redis.js`):

1. **Só grava se o placar existir** (script Lua com `EXISTS` + `ZADD`, executado de forma atômica
   pelo Redis). Sem isso, depois de um restart do Redis, a primeira aprovação criaria um placar
   com **uma pessoa só**, e todo mundo leria "posição 1".
2. **Reconstrução numa transação do Redis** (`MULTI` ... `EXEC`): `DEL` + `ZADD` em lotes de 1.000 +
   `EXPIRE`. Ninguém lê um placar pela metade.
3. **Depois do COMMIT, nunca antes:** antes do COMMIT os pontos ainda podem ser desfeitos.

✅ **Evidência de consistência:** `./scripts/conferir-placar.sh` compara o placar inteiro com o
SQL: **5.876 participantes, 0 diferenças**. O `testar-api.sh` confere a posição Redis × SQL na
reconstrução, depois do Write-Through, com o Redis fora e com ele de volta vazio.

❓ **"Por que não usou só o Sorted Set?"** → Para o top 100 com nomes, a string JSON é a resposta
pronta da API. O Sorted Set guarda só ids e scores; os nomes exigiriam outra estrutura. Cada
padrão resolve a leitura para a qual é melhor.

## R.3 Aula 2 · do MER ao relacional

| Regra da aula | No EJ Quest |
|---|---|
| Entidades viram tabelas | `usuario`, `trilha`, `avaliacao`... |
| Relacionamento 1:N vira FK no lado N | `modulo.id_trilha`, `licao.id_modulo` |
| Relacionamento N:N vira tabela associativa | `vinculo_diretoria` (usuário × diretoria, com o atributo `papel`) e `matricula` (usuário × trilha) |
| 1FN, 2FN, 3FN | Ver cap. 1.6 e a seção 3.2 de `docs/arquitetura-e-modelagem.md` |

## R.4 Aula 5 · views, procedures e triggers

### Views

| Conceito da aula | No EJ Quest |
|---|---|
| View é tabela virtual: guarda só o SELECT | As 3 views não ocupam espaço com dados |
| Prefixo `vw_` | `vw_ranking_consolidado`, `vw_progresso_membro`, `vw_fila_avaliacao` |
| Simples × complexa × materializada | As 3 são **complexas** (JOINs, GROUP BY, subconsultas). Nenhuma materializada: o "resultado guardado" do ranking está no Redis, não numa materialized view |
| View atualizável | As nossas **não são** atualizáveis (têm agregação e JOIN). Nem precisam: escrita passa pelas procedures |
| Segurança por ocultação | `vw_fila_avaliacao` entrega ao gestor só o que a tela precisa, sem senha nem gabarito |

❓ **Quiz da aula, questão 1:** "Qualquer visão com GROUP BY e JOINs aceita INSERT" é a afirmação
**incorreta**. Exemplo próprio: tentar `INSERT INTO vw_ranking_consolidado` dá erro.

### Procedures

| Conceito da aula | No EJ Quest |
|---|---|
| Invocada com `CALL` | `CALL sp_aprovar_projeto(T, 2, 'ok')` |
| Parâmetros IN, OUT, INOUT | `p_tentativa`, `p_avaliador`, `p_parecer` são IN; `p_status` é **INOUT** (entra NULL, sai "aprovada"). `sp_enviar_projeto` tem dois INOUT: id e número da tentativa |
| Procedure × function | Procedures fazem a ação; as funções `fn_pode_avaliar` e `fn_travar_tentativa` calculam e devolvem valor |
| Vantagem: menos tráfego e regra centralizada | A API manda **um** `CALL`; a validação, o bloqueio e os INSERTs rodam no servidor do banco |
| Erro de regra | A aula usa `SIGNAL SQLSTATE '45000'` (MySQL). No PostgreSQL é `RAISE EXCEPTION ... USING ERRCODE`. Usamos códigos próprios (`EJ403`, `EJ409`...) que a API traduz para HTTP |

❓ **Quiz, questão 4** (`sp_dobrar` com INOUT 10): o resultado é **20**, porque INOUT entra e sai.
No projeto: `p_status` entra NULL e sai com o status.

### Triggers

| Conceito da aula | No EJ Quest |
|---|---|
| `AFTER` × `BEFORE` | `trg_conclusao_pontua` é **AFTER INSERT** (age depois que a conclusão entrou). As `trg_*_imutavel` são **BEFORE UPDATE OR DELETE** (agem antes e cancelam) |
| `FOR EACH ROW` × `FOR EACH STATEMENT` | Todas são por linha |
| `OLD` e `NEW` | INSERT só tem `NEW` (a pontuação usa `NEW.id_participacao` e `NEW.concluida_em`). UPDATE tem os dois; DELETE só tem `OLD` |
| "Se der para resolver com constraint, prefira constraint" | Seguido à risca: unicidade, referência e valores proibidos são PK, FK, UNIQUE e CHECK. Trigger só onde constraint não alcança: **criar** a pontuação junto (ação) e **proibir** UPDATE/DELETE (constraint não proíbe operação) |
| Cuidado: bulk insert com trigger por linha fica lento | Na carga, as 34.101 conclusões passam pela trigger uma a uma. É o preço de os pontos nascerem pelo mesmo caminho da API (ver cap. 4) |
| Cuidado: lógica oculta e cascata | Documentado no cap. 3 e nos comentários de `04_regras.sql`. Não há trigger que dispara outra trigger |

❓ **Quiz, questão 6** (trigger `AFTER DELETE` usando `NEW.nome`): erro, porque **em DELETE não
existe NEW**. É por isso que `fn_bloquear_alteracao` devolve `OLD`.

## R.5 Aula 6 · transações, concorrência e recuperação

### ACID no EJ Quest (resumo; detalhe no cap. 3.4)

| Propriedade | Como aparece | Teste |
|---|---|---|
| Atomicidade | Resultado, conclusão e pontuação entram juntos ou nenhum entra | 1/1/1 → ROLLBACK → 0/0/0 |
| Consistência declarativa | 25 operações proibidas recusadas por restrições, triggers e procedures | `testes-banco.txt` |
| Consistência semântica | "Uma recompensa por conclusão" (procedure + PK) | Duas sessões |
| Isolamento | `FOR UPDATE` serializa as aprovações da mesma participação | Duas sessões |
| Durabilidade | O COMMIT só responde depois de o WAL ir para o disco | Ver abaixo |

### As anomalias da aula, no nosso cenário

| Anomalia | Como seria no EJ Quest | Por que não acontece |
|---|---|---|
| **Lost update** | Dois gestores leem "sem conclusão" e os dois gravam | `SELECT ... FOR UPDATE` na participação: o segundo espera. É **exatamente** o "Cenário A" do script de laboratório da aula 6 (bloqueio pessimista) |
| **Dirty read** | Ver pontos de uma aprovação que ainda pode sofrer ROLLBACK | O PostgreSQL nunca mostra dado não confirmado, nem em `READ UNCOMMITTED` (que nele funciona como `READ COMMITTED`) |
| **Non-repeatable read** | Duas leituras da mesma participação na transação veem valores diferentes | Possível em `READ COMMITTED`, e **é isso que salva a sessão B**: quando ela destrava, a releitura enxerga a conclusão que A confirmou |
| **Phantom read** | Contar entregas aguardando e aparecer uma nova no meio | Possível em `READ COMMITTED`; o envio (RN08) trava a participação, então não entra outro envio da mesma participação |
| **Write skew** | Duas transações leem o mesmo estado e gravam linhas diferentes que juntas violam a regra | Evitado porque as duas gravariam a **mesma** linha de `conclusao` (PK) e passam pela **mesma** trava |

### Níveis de isolamento no PostgreSQL (o que o livro não conta)

| Nível ANSI | No PostgreSQL |
|---|---|
| Read Uncommitted | Aceito no comando, mas se comporta como Read Committed |
| **Read Committed** (padrão) | Cada comando vê o que já foi confirmado. **É o que o projeto usa** |
| Repeatable Read | Implementado como **Snapshot Isolation** (MVCC): também impede phantom, mas permite write skew |
| Serializable | **SSI** (Serializable Snapshot Isolation): impede tudo, mas aborta transações em conflito, que precisam ser repetidas |

❓ **"Por que não Serializable?"** → Resolveria, mas a API teria de repetir a transação a cada
falha de serialização. O bloqueio explícito com `FOR UPDATE` dá o mesmo resultado para esta regra,
com uma espera curta em vez de um erro, e é mais fácil de demonstrar (DEC-008). A aula diz: quanto
maior o isolamento, menor a vazão.

### Locks, 2PL e deadlock

- 🧠 `FOR UPDATE` pega um **lock exclusivo (X)** na linha da participação. Pela matriz da aula, X
  é incompatível com X: a segunda aprovação espera.
- 🧠 O PostgreSQL segura os locks X **até o COMMIT ou ROLLBACK**: é o **Strict 2PL** da aula.
- 🧠 **Deadlock:** precisa de um ciclo (A espera B, B espera A). Nossas procedures travam **uma
  linha só** (a participação) por transação, então não formam ciclo. Se acontecesse, o PostgreSQL
  **detecta** o ciclo (depois de `deadlock_timeout`, 1 s por padrão) e aborta uma das transações.
  Ele não usa wait-die nem wound-wait: usa detecção.
- 🔧 **Para ver o lock ao vivo na demo**, abra uma terceira janela enquanto a sessão B espera e
  rode a consulta do próprio script da aula:

```sql
SELECT pid, pg_blocking_pids(pid) AS bloqueado_por, state, left(query, 60) AS comando
FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

### WAL e recuperação

- 🧠 **WAL (Write-Ahead Log):** a alteração vai primeiro para o log; a página de dados vai para o
  disco depois. O COMMIT só é confirmado quando o registro do log está em disco (`fsync`).
- 🧠 No **PostgreSQL**, a recuperação depois de uma queda é só **REDO**: ele reaplica o WAL desde o
  último checkpoint. **Não existe a fase de UNDO** do ARIES, porque o PostgreSQL usa **MVCC**:
  ele não sobrescreve a linha antiga, cria uma versão nova. As versões de uma transação que não
  confirmou ficam simplesmente invisíveis (o registro de status das transações diz que ela
  abortou).
- 🔧 No projeto: o volume `dados_postgres` guarda os arquivos de dados **e** o WAL (`pg_wal/`).
  Derrubar o contêiner no meio de uma aprovação não deixa a aprovação pela metade.
- ⚠️ O Redis do projeto roda **sem** log nem snapshot (`--save "" --appendonly no`): durabilidade
  zero, de propósito. Tudo nele é cópia.

## R.6 PW1 · o que o professor vai procurar (fase de 15 a 25/11)

| Item da Tabela 1 (AB2 de PW1) | Aula | Como vai aparecer no EJ Quest |
|---|---|---|
| Página inicial dividida em partes | 2, 3 | Topo, navegação e conteúdo como componentes |
| Locomoção dos componentes | 3 (Flexbox) | Layouts com `display: flex` |
| Estilização em texto e imagem | 3, 5 | Tokens do protótipo no CSS, avatar e ilustrações |
| Rotas | 8 | `react-router-dom`: Jornada, Ranking, Perfil, Avaliar |
| Props | 7 | Componentes de card, nó da trilha e linha do ranking |
| React Icons | 9 | Ícones da navegação e dos status |
| onChange e onClick | 10, 13 | Formulário do desafio e parecer do gestor |
| useState e renderização condicional | 10, 11 | Carregando, vazio, erro, sem permissão |
| Conexão com banco | 12, 13, 14 | `axios` + `useEffect` chamando a API; `.map()` nas listas |
| README, Trello, GitHub, sistema online | Descrição da AB2 | README pronto; Trello e deploy em aberto |

**Diferenças de ferramenta, e como justificar:** o professor usa CRA, `yarn` e MySQL. O projeto
usa Vite, `npm` e PostgreSQL. O CRA foi descontinuado pelo próprio time do React em 2025, e o
PostgreSQL é exigência de BD2. Os conceitos avaliados (componentes, rotas, estado, efeitos,
conexão com o banco pelo servidor) são os mesmos.

🔧 **O servidor da aula 12 × o nosso:**

| Aula 12 (MySQL) | EJ Quest |
|---|---|
| Pasta `server/` | Pasta `api/` |
| `express`, `cors`, `mysql`, `nodemon` | `express`, CORS escrito à mão, `pg` e `redis`, `node --watch` |
| `db.query("INSERT ... VALUES ('" + valor + "')")` (texto colado) | `client.query('... $1', [valor])` (parametrizado: protege de SQL injection) |
| SQL dentro da rota | SQL no repositório; rota só traduz HTTP |

## R.7 Boas práticas de programação aplicadas (para citar)

1. **Consultas parametrizadas** sempre (`$1`, `$2`): nada de valor concatenado no SQL.
2. **Camadas com uma responsabilidade cada:** rota → serviço → repositório → banco.
3. **Transação numa conexão reservada**, com `ROLLBACK` no erro e `release()` no `finally`.
4. **Erros em JSON, sem detalhe interno**; códigos HTTP corretos (400, 401, 403, 404, 409, 503).
5. **O banco se defende sozinho**: a regra crítica vale até para quem não passa pela API.
6. **Falhar com elegância**: Redis fora não derruba nada (timeout de 300 ms e caminho pelo SQL).
7. **Medir antes de afirmar**: o índice planejado foi descartado porque a medição mostrou ganho zero.
8. **Testes que acham erro de verdade**: os testes pegaram três erros (dois `CHECK` com `NULL`,
   uma ordem de validação).
9. **Reprodutível**: semente fixa, um comando sobe tudo, saídas guardadas em `docs/resultados/`.
10. **Sem segredo no repositório**: `.env` fora do Git, `.env.example` com valores de exemplo.
11. **Decisão registrada**: cada escolha não óbvia tem uma DEC com contexto e alternativas.

## R.8 Os números que valem (rodada final de 12/11/2026)

**Ambiente:** notebook com Linux, 20 núcleos, 14 GB de RAM; PostgreSQL 16, Redis 7 e API em Docker
na mesma máquina. O medidor HTTP roda dentro do contêiner da API (não exige Node na máquina); por
isso a vazão com Redis é menor que a de uma rodada anterior medida de fora (2.111 req/s): o
medidor e a API disputam o mesmo processador. A proporção com e sem Redis se mantém. Carga: 140.574 tentativas, semente 0,42.

| Experimento | Sem | Com | Ganho | Fonte |
|---|---|---|---|---|
| 20 entregas mais recentes (índice) | 53,0 ms · Seq Scan | **0,26 ms** · Index Scan | ~200× | `indice.txt` |
| Entregas dos últimos 30 dias (índice) | 36,7 ms · Seq Scan | **12,1 ms** · Index Only Scan | ~3× | `indice.txt` |
| Top 100, latência mediana (cache) | 59,3 ms · Postgres | **4,9 ms** · Redis | ~12× | `cache.txt` |
| Top 100, vazão com 20 clientes | 159 req/s | **898 req/s** | ~6× | `cache.txt` |
| Minha posição, vazão com 20 clientes | 148 req/s · `row_number()` | **1.304 req/s** · `ZREVRANK` | ~9× | `cache.txt` |
| Índice planejado (histórico da participação) | 0,25 ms | 0,28 ms | nenhum | DEC-010 |

Os números variam alguns milissegundos entre rodadas; a ordem de grandeza se mantém. Os caps. 2,
5 e 6 citam rodadas anteriores (por exemplo, 41,5 ms e 43 ms): **vale esta tabela**. Diga na
apresentação que são medições locais, sem rede entre a API e os bancos.

## R.9 Perguntas novas que os materiais sugerem

| Pergunta | Resposta curta |
|---|---|
| Qual padrão de sincronização você usou? | Dois: Cache-Aside no top 100 e Write-Through no placar (R.2) |
| Por que Sorted Set? | Posição em O(log N), sempre ordenada; o professor sugere para leaderboards |
| Como garante que o Redis e o SQL concordam? | O SQL é a fonte; o Redis é refeito dele; `conferir-placar.sh` dá 0 diferenças em 5.876 |
| Qual a vazão do sistema? | 898 req/s no top 100 com cache, 159 sem (20 clientes, local) |
| Sua view é atualizável? | Não: tem agregação e JOIN. A escrita passa pelas procedures |
| Qual a diferença entre BEFORE e AFTER na sua trigger? | AFTER cria a pontuação depois que a conclusão entrou; BEFORE cancela o UPDATE/DELETE antes de acontecer |
| Por que a trigger de imutabilidade e não uma constraint? | Constraint não proíbe operação, só valores |
| Qual nível de isolamento você usa? | Read Committed (padrão do PostgreSQL) + `FOR UPDATE` |
| Seu sistema tem deadlock? | Cada transação trava uma linha só: sem ciclo. Se houvesse, o PostgreSQL detecta e aborta uma |
| O que é o WAL e o que acontece se o servidor cair? | Log gravado antes dos dados; na volta, o PostgreSQL refaz (REDO) o que foi confirmado e ignora o que não foi (MVCC) |
| E o Redis, é durável? | Não, de propósito: é cópia; reconstrói do PostgreSQL |

✍️ **Minhas notas**
>
