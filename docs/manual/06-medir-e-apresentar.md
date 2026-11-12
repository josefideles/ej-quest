# Capítulo 6 · Medir e apresentar: o roteiro da AB2 de BD2 (13/11/2026, 18h30)

> **Objetivo:** chegar na apresentação sabendo o que mostrar, em que ordem, com quais comandos e
> o que responder. A AB2 é avaliada como apresentação técnica a um stakeholder: código, visual,
> explicação, embasamento e **por que cada escolha venceu as alternativas**.
>
> **Tempo de leitura:** ~20 min + um ensaio da demo (~15 min)

---

## 6.1 Plano de estudo até a apresentação

| Ordem | O quê | Tempo | Por quê |
|---|---|---|---|
| 1 | Cap. 1 (modelo, 3FN, restrições) | 40 min | Base de tudo; já estava na fila |
| 2 | Cap. 3 (trigger, procedure, ACID, `FOR UPDATE`) | 35 min | É o coração da avaliação |
| 3 | Cap. 5 (API e cache) | 30 min | Segunda metade da persistência poliglota |
| 4 | Cap. 2 e 4 (schema, índice, carga) | 45 min | Detalhes e as histórias dos testes |
| 5 | Este capítulo + **rodar a demo uma vez inteira** | 35 min | Tirar o susto antes da hora |

Total: cerca de 3 h. Se faltar tempo, corte o item 4 e leia só as seções ❓ dele.

**Gate (constituição 10):** depois de cada capítulo, explique em voz alta, sem olhar, as perguntas
❓ do fim. O que não sair, marque em "Minhas notas" e traga para revisar comigo.

## 6.2 Roteiro da apresentação (~15 min)

| # | Parte | Tempo | O que mostrar | A frase que fica |
|---|---|---|---|---|
| 1 | Problema | 1 min | Tela do protótipo (Jornada e Ranking) | "Gestão do conhecimento gamificada para EJs: trilhas, desafios avaliados e ranking." |
| 2 | Arquitetura | 2 min | Diagrama de camadas (cap. 0) | "PostgreSQL é o livro-caixa; Redis é o quadro branco. Se apagar o quadro, refaço pelo livro." |
| 3 | Modelo | 3 min | ER (cap. 1), `participacao_avaliacao` | "A normalização cria os JOINs que o resto da disciplina resolve: view organiza, índice acelera, cache evita repetir." |
| 4 | O banco se defende | 2 min | `./scripts/testar-banco.sh` (seção 1) | "13 operações proibidas, 13 recusas. E o teste achou um erro meu: CHECK aceita NULL." |
| 5 | A regra crítica | 3 min | **Demo ao vivo das duas janelas** (6.3) | "Dois gestores, mesma entrega, mesmo segundo: uma conclusão, um ponto." |
| 6 | Números | 2 min | `indice.txt` e `cache.txt` | "Medi antes de afirmar. O índice que eu planejei não ajudava, e eu troquei." |
| 7 | Recortes e próximos passos | 1 min | Seção 6.5 | "Login por cabeçalho é recorte declarado; telas e login real entram em PW1." |
| | Perguntas | 1 min+ | Seção 6.6 | |

## 6.3 A demo, comando por comando

**Antes de começar (uns 10 min antes):**

```bash
cd ej-quest
docker compose up -d --build
./scripts/recriar-banco.sh          # carga limpa, ~25 s
curl -s localhost:3000/saude        # {"api":"ok","postgres":"ok","redis":"ok"}
```

Abra **dois terminais lado a lado**, os dois com:

```bash
docker compose exec db psql -U ej_quest -d ej_quest
```

**Janela A**, escolha uma entrega aguardando parecer em Projetos (gestor 2):

```sql
SELECT id_tentativa, id_participacao, membro FROM vw_fila_avaliacao
WHERE id_diretoria = 1 ORDER BY id_tentativa LIMIT 1;
```

Anote `T` (tentativa) e `P` (participação). Então:

| Passo | Janela A | Janela B | O que dizer |
|---|---|---|---|
| 1 | `BEGIN;` | | "Abro a transação, como a API faz." |
| 2 | `CALL aprovar_projeto(T, 2, 'ok');` → `aprovada` | | "O gestor de Projetos aprovou, mas ainda não confirmou." |
| 3 | | `CALL aprovar_projeto(T, 1, 'ok');` → **fica parada** | "O gestor geral tenta aprovar a mesma entrega. Ela espera no `FOR UPDATE`." |
| 4 | `COMMIT;` | → `ja_aprovada` | "A primeira confirmou. A segunda destravou, viu a conclusão e não deu ponto de novo." |
| 5 | `SELECT count(*) FROM pontuacao WHERE id_participacao = P;` → `1` | | "Um ponto só." |

**Cache e Redis fora** (num terceiro terminal, se der tempo):

```bash
curl -s localhost:3000/ranking -H 'X-Usuario-Id: 2' | head -c 120   # origem: postgres
curl -s localhost:3000/ranking -H 'X-Usuario-Id: 2' | head -c 120   # origem: cache
docker compose stop cache
curl -s localhost:3000/ranking -H 'X-Usuario-Id: 2' | head -c 120   # origem: postgres, sem erro
docker compose start cache
```

⚠️ **Plano B:** se algo falhar ao vivo, mostre a mesma cena já gravada em
`docs/resultados/testes-banco.txt` (seção 3) e `testes-api.txt`. Ter a evidência guardada
é exatamente para isso.

## 6.4 Os números (copie para o slide)

**Ambiente:** notebook com Linux, 20 núcleos, 14 GB de RAM; PostgreSQL 16, Redis 7 e API em
Docker local. Carga: 140.574 tentativas, semente 0,42.

| Experimento | Sem | Com | Fonte |
|---|---|---|---|
| 20 entregas mais recentes (índice) | 41,5 ms · Seq Scan | **0,17 ms** · Index Scan | `indice.txt` |
| Entregas dos últimos 30 dias (índice) | 34,9 ms · Seq Scan | **7,3 ms** · Index Only Scan | `indice.txt` |
| `GET /ranking`, mediana (cache) | 43,0 ms · Postgres | **3,0 ms** · Redis | `cache.txt` |
| `GET /ranking`, p95 (cache) | 58,4 ms | **5,4 ms** | `cache.txt` |
| Índice planejado (histórico da participação) | 0,25 ms | 0,28 ms | DEC-010: não ajudava, saiu |

Diga com honestidade (constituição 8): **são medições locais**, com a API e o banco na mesma
máquina. Em produção, a rede somaria tempo aos dois lados.

### O modelo chave-valor (o "diagrama de coleções" do Redis)

| Chave | Tipo | TTL | Valor | Quem grava | Quem apaga |
|---|---|---|---|---|---|
| `ranking:geral:v1` | string (JSON) | 60 s | `{ gerado_em, total_participantes, participantes: [{ posicao, id_usuario, nome, total_pontos, ultima_concessao }] }` (top 100) | `GET /ranking` em cache miss | aprovação nova, depois do COMMIT |

O `:v1` no nome permite mudar o formato do JSON no futuro sem ler um valor velho: basta passar a
usar `:v2`.

## 6.5 Recortes declarados (diga antes que perguntem)

- **Identificação por cabeçalho** (`X-Usuario-Id`, DEC-004): não é segurança. Login com bcrypt e
  sessão entra em PW1.
- **Telas:** o protótipo tem 13 telas no Figma. A integração com a API é a fase de PW1.
- **Carga sintética:** volume e proporções escolhidos, não observados.
- **Quiz pela API:** o banco já guarda respostas e corrige; a rota de envio de quiz é P1.

## 6.6 Banco de perguntas (as mais prováveis)

| Pergunta | Resposta curta | Onde aprofundar |
|---|---|---|
| Por que dois bancos? | Integridade e histórico no relacional; leitura repetida e descartável no chave-valor | Cap. 0 |
| Por que Redis e não MongoDB? | O dado do NoSQL é um valor pronto com TTL, caso clássico de chave-valor. Não há documento flexível no MVP | Cap. 0 |
| Mostre a 3FN | `tentativa` e `pontuacao` não têm `id_usuario` | Cap. 1.6 |
| Por que existe `participacao_avaliacao`? | Agrupa tentativas, garante unicidade, é a linha travada e a chave da conclusão | Cap. 1.5 |
| O que impede ponto duplicado? | Três camadas: `FOR UPDATE`, idempotência na procedure e PK em `conclusao`/`pontuacao` | Cap. 3 |
| E se cair no meio? | Transação: tudo ou nada. Teste de atomicidade | Cap. 3.4 |
| Procedure x function? | `CALL` para ação; `SELECT` para valor | Cap. 3.3 |
| Por que não SERIALIZABLE? | Resolveria, mas exige repetir a transação no conflito; o bloqueio explícito é mais simples de explicar e demonstrar | Cap. 3.5, DEC-008 |
| View deixa mais rápido? | Não; organiza. Quem acelera é índice e cache | Cap. 3.1 |
| O índice ajudou? | O planejado, não; o atual, sim, e mais quanto mais seletiva a consulta | Cap. 2.4 |
| Cache pode errar? | Pode atrasar até 60 s; nunca inventa | Cap. 5.3 |
| Redis caiu, e aí? | Sistema segue pelo Postgres | Cap. 5.4 |
| Por que sem ORM? | Esconderia transação e bloqueio | DEC-003 |
| Como eu rodo? | `cp .env.example .env`, `docker compose up -d --build`, `./scripts/recriar-banco.sh` | README |

✍️ **Minhas notas**
>
