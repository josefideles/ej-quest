# Capítulo 2 · O schema que foi escrito: DDL, restrições e índice

> **Objetivo:** abrir `db/01_schema.sql` e `db/02_indices.sql` e conseguir explicar cada linha
> que importa. O cap. 1 explicou o modelo; este mostra como ele virou código e o que os testes
> descobriram.
>
> **Tempo de leitura:** ~30 min · **Arquivos:** `db/01_schema.sql`, `db/02_indices.sql`,
> `db/testes/01_restricoes.sql` · **Evidência:** `docs/resultados/testes-banco.txt`

---

## 2.1 Como rodar e olhar

```bash
docker compose up -d                 # sobe db, cache e api
./scripts/recriar-banco.sh           # apaga tudo e roda db/01 a 05 (~25 s)
docker compose exec db psql -U ej_quest -d ej_quest
```

Dentro do `psql`: `\dt` (16 tabelas), `\d tentativa_avaliacao` (colunas e restrições),
`\di` (índices), `\dv` (views), `\df` (funções e procedures).

## 2.2 Os tipos escolhidos

| Tipo | Onde | Por quê |
|---|---|---|
| `bigint GENERATED ALWAYS AS IDENTITY` | toda chave substituta | O banco gera o número. `ALWAYS` recusa um id digitado "na mão" por engano. `bigint` porque tentativas crescem rápido |
| `text` | nomes, títulos, pareceres | No PostgreSQL, `text` e `varchar` têm o mesmo desempenho. O limite que importa vira `CHECK` |
| `timestamptz` | todo "quando" | Guarda o instante absoluto (com fuso). `timestamp` sem fuso daria horários errados entre servidor e usuário |
| `numeric(5,2)` | percentuais | Número exato (até 100,00). `float` erraria casas decimais |
| `boolean` | `ativo`, `correta`, `obrigatoria` | Sim ou não, sem "S"/"N" em texto |

## 2.3 Restrições que valem uma explicação

### Índice único em expressão (RN01)

```sql
CREATE UNIQUE INDEX usuario_email_uk ON usuario (lower(email));
```

`UNIQUE (email)` deixaria `Gabriel@x.com` e `gabriel@x.com` conviverem. O índice é sobre o
**resultado** de `lower(email)`, então os dois viram o mesmo valor e o segundo é recusado
(teste 6).

### Índice único parcial (RN05)

```sql
CREATE UNIQUE INDEX alternativa_uma_correta_uk ON alternativa (id_questao) WHERE correta;
```

Só as linhas com `correta = true` entram no índice. Como ele é único por questão, **no máximo
uma alternativa correta por questão** (teste 7). As erradas podem ser quantas quiser.

### FK composta: "a peça certa do lugar certo"

```sql
-- resposta_tentativa
FOREIGN KEY (id_questao, numero_alternativa) REFERENCES alternativa (id_questao, numero)

-- conclusao
FOREIGN KEY (id_participacao, id_tentativa) REFERENCES tentativa_avaliacao (id_participacao, id_tentativa)
```

A primeira garante que a alternativa escolhida existe **naquela questão** (teste 9). A segunda
garante que a tentativa que fundamenta a conclusão **pertence àquela participação**. Sem ela,
daria para concluir a participação do Gabriel com a tentativa da Ana (teste 8). Para uma FK
composta funcionar, o lado referenciado precisa de `UNIQUE` no par. Por isso
`tentativa_avaliacao` tem `UNIQUE (id_participacao, id_tentativa)`, que parece redundante e não é.

### A armadilha do NULL no CHECK (o teste pegou)

🧠 **Regra:** `CHECK` só recusa quando a expressão dá **FALSE**. Se der **NULL**, ele **aceita**.

A primeira versão era:

```sql
CHECK ((tipo = 'quiz' AND percentual_minimo BETWEEN 0 AND 100) OR
       (tipo = 'projeto' AND percentual_minimo IS NULL))
```

Um quiz com `percentual_minimo` NULL: `NULL BETWEEN 0 AND 100` é NULL; `NULL OR FALSE` é NULL;
o CHECK **aceitou**. O teste 10 mostrou "FALHOU: o banco aceitou". A correção foi
`percentual_minimo IS NOT NULL AND ...`. O mesmo erro existia no parecer obrigatório do pedido
de ajustes (teste 13).

❓ Essa história é ótima para a apresentação: mostra que **os testes servem para achar erro**,
não para enfeitar.

### `ON DELETE RESTRICT` em tudo (RN17)

Nenhuma FK usa `CASCADE`. Apagar um usuário com histórico é recusado (teste 5). Desligar é
`UPDATE usuario SET ativo = false`: some do ranking (a view filtra `ativo`) e o histórico fica.

## 2.4 O índice: o que a medição mudou (DEC-010)

O plano previa `idx_tentativa_participacao_data (id_participacao, enviada_em)`. Medido:

| Consulta | Com o índice planejado | Sem ele |
|---|---|---|
| Histórico de uma participação, mais recente primeiro | 0,28 ms | 0,25 ms |

Não mudou nada. Motivo: as `UNIQUE` que começam por `id_participacao` já criaram índices, e o
planejador usou um deles. **Índice que não ajuda só custa**: ocupa disco e deixa cada INSERT mais
lento. Saiu.

Entrou `idx_tentativa_enviada_em (enviada_em)`, para o painel do gestor (medianas de 5 execuções,
`docs/resultados/indice.txt`):

| Consulta | Com índice | Sem índice | Plano sem índice → com índice |
|---|---|---|---|
| As 20 entregas mais recentes | **0,17 ms** | 41,5 ms | Seq Scan + Sort → Index Scan Backward |
| Entregas dos últimos 30 dias (8,9% das linhas) | **7,3 ms** | 34,9 ms | Seq Scan → Index Only Scan |

🧠 **Por que a segunda ganha menos?** Seletividade. Pegar 20 linhas de 140 mil é o caso ideal do
índice. Pegar 12 mil (8,9%) ainda ganha, mas o banco precisa percorrer um pedaço grande do índice.
Se fossem 60% das linhas, o planejador preferiria o Seq Scan, e estaria certo.

🧠 **Index Only Scan:** a consulta só precisa de `enviada_em`, que já está no índice. O banco nem
abre a tabela.

⚠️ O PostgreSQL **não cria índice em coluna de FK sozinho** (o MySQL cria). Aqui não fez falta
porque todas as FKs consultadas são a primeira coluna de alguma PK ou UNIQUE. Em outro projeto,
confira com `\d tabela`.

## 2.5 Como ficou no projeto

- 16 tabelas e, contados no catálogo (`pg_constraint`) em 12/11/2026: 16 PK (3 compostas),
  21 FK (2 compostas), 9 UNIQUE (7 compostas), 22 CHECK e 2 índices únicos especiais (expressão
  e parcial).
- `recriar-banco.sh` roda do zero em cerca de 25 s, com a carga.
- 13 operações proibidas testadas e recusadas: `db/testes/01_restricoes.sql`.

## 2.6 ❓ O que o professor pode perguntar

- **"Por que `GENERATED ALWAYS` e não `SERIAL`?"** → É o padrão SQL, e `ALWAYS` impede inserir
  id manual. `SERIAL` é atalho antigo do PostgreSQL.
- **"Mostre o banco se defendendo."** → `./scripts/testar-banco.sh`, seção 1.
- **"Esse índice ajudou?"** → Mostrar `docs/resultados/indice.txt`, e contar que o primeiro índice
  não ajudou e por quê.
- **"FK cria índice?"** → No PostgreSQL, não.
- **"CHECK com NULL?"** → Aceita. Contar o teste 10.

✍️ **Minhas notas**
>
