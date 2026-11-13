# Capítulo 3 · Regras dentro do banco: views, trigger, procedures, ACID e `FOR UPDATE`

> **Objetivo:** explicar, sem ler o código, como uma aprovação acontece e por que ela nunca
> gera ponto duplicado, nem com dois gestores clicando ao mesmo tempo.
>
> **Tempo de leitura:** ~35 min · **Arquivos:** `db/03_views.sql`, `db/04_regras.sql`,
> `db/testes/02_regras.sql`, `scripts/testar-banco.sh` · **Evidência:** `docs/resultados/testes-banco.txt`

---

## 3.1 Views: organizar, não acelerar

| View | Uma linha por | Para quê |
|---|---|---|
| `vw_ranking_consolidado` | usuário ativo com pontos | Soma dos pontos e última concessão. A API ordena (RN12) |
| `vw_progresso_membro` | matrícula | Avaliações exigidas, concluídas e percentual (RN11) |
| `vw_fila_avaliacao` | entrega de desafio sem parecer | Fila do gestor (tela 10), com a diretoria para filtrar o escopo |

🧠 **View comum guarda a consulta, não o resultado.** Ela não deixa nada mais rápido. Quem guarda
resultado pronto é a `MATERIALIZED VIEW` (não usamos) ou o cache (Redis).

🔧 **O caminho do ranking:** `pontuacao → participacao_avaliacao → matricula → usuario`. São 3
JOINs porque, pela 3FN, `pontuacao` não guarda o usuário. A view esconde esse caminho de quem
consulta.

🔧 **Anti-join na fila:** "entrega sem parecer" é `NOT EXISTS (SELECT 1 FROM resultado_tentativa
WHERE ...)`. É a forma idiomática de perguntar "não existe linha relacionada".

## 3.2 A trigger: pontos nascem junto com a conclusão

```sql
CREATE TRIGGER trg_conclusao_pontua
    AFTER INSERT ON conclusao
    FOR EACH ROW EXECUTE FUNCTION fn_conceder_pontos();
```

| Palavra | Significa |
|---|---|
| `AFTER INSERT` | Roda depois que a linha de conclusão entrou e passou nas restrições |
| `FOR EACH ROW` | Uma vez por linha inserida (na carga, 34 mil vezes) |
| `NEW` | A linha que acabou de entrar. A função lê `NEW.id_participacao` e `NEW.concluida_em` |

A função busca `pontos_previstos` da avaliação e insere em `pontuacao` com
`concedida_em = NEW.concluida_em` (RN13: o desempate usa o momento da aprovação).

🧠 **Atomicidade de graça:** a trigger roda **dentro da mesma transação** do INSERT. Se ela falhar,
a conclusão também é desfeita. Conclusão sem pontos, ou pontos sem conclusão, não existe.

❓ **"Por que trigger e não a procedure inserir os pontos?"** → Porque assim **qualquer** caminho
que crie conclusão gera pontos: a procedure, a carga, um `INSERT` manual. A regra está no lugar
de onde não dá para fugir.

## 3.3 As procedures

| Procedure | Quem chama | O que faz |
|---|---|---|
| `sp_aprovar_projeto(tentativa, avaliador, parecer, INOUT status)` | gestor | Trava, valida, grava resultado "aprovada" e conclusão (a trigger dá os pontos) |
| `sp_pedir_ajustes(tentativa, avaliador, parecer, INOUT status)` | gestor | Trava, valida, grava resultado "ajustes" com parecer obrigatório |
| `sp_enviar_projeto(usuario, avaliacao, link, descricao, INOUT id, INOUT numero)` | membro | Cria a participação na 1ª vez, aplica RN06, RN07 e RN08 e numera |

🧠 **Procedure x function:** procedure é chamada com `CALL` e serve para **executar uma ação**. Function
é chamada dentro de `SELECT` e serve para **calcular um valor**. O `INOUT` é como a procedure
"responde" a quem chamou: a API lê `rows[0].p_status`.

🧠 **Nenhuma procedure faz COMMIT.** Quem abre e fecha a transação é quem chama (a API ou você no
`psql`). Assim a procedure, a trigger e o que mais estiver na transação confirmam ou desfazem
juntos.

### O passo a passo de `sp_aprovar_projeto`

```
1. fn_travar_tentativa: acha a participação da tentativa e trava a linha (SELECT ... FOR UPDATE)
2. fn_validar_avaliador: é desafio? não é o dono (autoaprovação)? é gestor desta diretoria?
3. já existe conclusão?          → devolve 'ja_aprovada' e para (idempotência)
4. a tentativa já tem parecer?   → erro EJ409
5. INSERT resultado_tentativa ('aprovada')
6. INSERT conclusao              → a trigger insere a pontuação
7. p_status := 'aprovada'
```

**Por que validar (2) antes da idempotência (3)?** O teste mostrou o motivo. Na primeira versão,
a ordem era a inversa, e "aprovar uma tentativa de **quiz** já concluída" devolvia `ja_aprovada`
em vez de recusar. Validar primeiro também evita mostrar o estado de uma entrega a quem não tem
permissão.

### Erros com código próprio

`RAISE EXCEPTION '...' USING ERRCODE = 'EJ403'`. A API lê o código e responde o HTTP certo
(`api/src/erros.js`): EJ400 → 400, EJ403 → 403, EJ404 → 404, EJ409 → 409. A mensagem da
procedure chega ao usuário. A de uma restrição violada não chega: vira uma frase genérica.

## 3.4 ACID no EJ Quest

| Letra | Onde aparece | Prova |
|---|---|---|
| **A**tomicidade | Resultado, conclusão e pontos entram juntos ou nenhum entra | Teste "falha provocada antes do COMMIT": 1, 1, 1 dentro da transação → 0, 0, 0 depois do ROLLBACK |
| **C**onsistência | PK, FK, UNIQUE, CHECK e a trigger levam o banco de um estado válido a outro | 13 inserts proibidos recusados |
| **I**solamento | `FOR UPDATE` faz a 2ª aprovação esperar a 1ª terminar | Teste das duas sessões |
| **D**urabilidade | Depois do COMMIT, o PostgreSQL grava no WAL antes de responder | O volume Docker guarda os dados entre reinícios |

## 3.5 Concorrência: o teste das duas sessões (RNF03)

Execução guardada em `docs/resultados/testes-banco.txt`, em ordem de horário:

```
A: 15:42:51.762  aprovou e segura o bloqueio por 3 s     (status: aprovada)
B: 15:42:52.778  chegou e pediu a aprovação              (fica ESPERANDO no FOR UPDATE)
A: 15:42:54.784  COMMIT                                  (libera a linha)
B: 15:42:54.790  destravou                               (status: ja_aprovada)
Final: 1 resultado, 1 conclusão, 1 pontuação
```

B esperou 2 s parada, e destravou 6 ms depois do COMMIT de A.

🧠 **O que o `FOR UPDATE` trava:** **a linha** da participação, não a tabela. Outras participações
seguem livres. O bloqueio dura **até o fim da transação** (COMMIT ou ROLLBACK).

🧠 **Por que READ COMMITTED basta?** É o nível padrão do PostgreSQL. Cada comando enxerga o que
já foi confirmado. Quando B destrava, a checagem "já existe conclusão?" roda **depois** do COMMIT
de A e enxerga a conclusão. `SERIALIZABLE` também resolveria, mas devolveria erro de
serialização e obrigaria a API a repetir a transação (DEC-008).

🧠 **Duas barreiras:** mesmo sem o `FOR UPDATE`, a PK de `conclusao` (id_participacao) recusaria a
segunda conclusão. A diferença: com o bloqueio, B recebe uma resposta limpa (`ja_aprovada`); sem
ele, receberia um erro de chave duplicada.

## 3.6 ❓ O que o professor pode perguntar

- **"O que acontece se o gestor clicar duas vezes?"** → 1ª: `aprovada`. 2ª: `ja_aprovada`. Um ponto só.
- **"E se dois gestores aprovarem ao mesmo tempo?"** → Teste das duas sessões.
- **"E se cair no meio?"** → ROLLBACK: nada gravado pela metade (teste de atomicidade).
- **"Por que a regra está no banco e não só na API?"** → Constituição 4: qualquer cliente do banco
  (a carga, um script, outra API) passa pelas mesmas regras.
- **"Trigger tem desvantagem?"** → É "invisível" para quem lê só o INSERT, e roda linha a linha
  (34 mil vezes na carga). Aceitamos pela garantia; está documentada aqui.

✍️ **Minhas notas**
>
