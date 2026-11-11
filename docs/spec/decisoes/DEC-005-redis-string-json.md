# DEC-005 · Ranking no Redis como string JSON com TTL (Cache-Aside); Sorted Set como evolução

- **Contexto:** a AB1 prometeu a chave `ranking:geral:v1` com o ranking serializado em JSON, TTL de 60 s e invalidação após aprovação. A especificação do professor, no tema 8 (EAD/Gamificação), sugere Redis **Sorted Sets** para leaderboards.

## Opções avaliadas

1. **String JSON + TTL (AB1).** O PostgreSQL calcula com a ordem exata da RN12 (total desc, última concessão asc, id asc). O Redis só guarda a resposta pronta (`SET ... EX 60`, `GET`, `DEL` após o COMMIT).
2. **Sorted Set (`ZADD`/`ZREVRANGE`/`ZREVRANK`).** Estrutura nativa de ranking: top N e posição de um usuário sem ler a lista toda. Dois problemas no MVP:
   - o score é um número só, e o desempate da RN12 depende da data da última pontuação;
   - atualizar com `ZINCRBY` a cada aprovação cria uma segunda fonte de números, que diverge do PostgreSQL se o Redis falhar entre o COMMIT e o incremento.
3. **Híbrido (Sorted Set + consultar o JSON só nos empates)**, sugerido pelo Fideles em 10/11. Descartado: empates são comuns (todos com 20 pontos depois do primeiro quiz), então quase toda página teria de ser corrigida fora do Redis, com duas estruturas para manter coerentes. A complexidade sobe e a leitura não fica mais barata.

## Decisão

**String JSON no MVP.** É o que foi prometido, mantém o PostgreSQL como única fonte e deixa o Cache-Aside limpo de demonstrar (frio, quente, Redis fora). Com ~500 usuários, a vantagem do Sorted Set não aparece.

## Argumento para a apresentação

> "Considerei o Sorted Set, que é o recomendado para leaderboards: brilha com muitos usuários e atualização incremental. Escolhi a string JSON porque o desempate da RN12 e a regra de o Redis nunca ser a fonte da verdade ficam mais seguros assim. Com escala maior, o Sorted Set é a evolução natural, e o caminho já está desenhado."

## Caminho de evolução (quando a escala pedir)

1. **Score composto resolve o empate dentro do próprio Sorted Set**, sem consultar outra estrutura:
   `score = total_pontos × 10^10 + (9.999.999.999 − segundos_da_ultima_concessao)`.
   Mais pontos sobe; com pontos iguais, quem pontuou antes tem score maior. Cabe com folga na precisão do `double` do Redis (até ~900 mil pontos). Membro com id preenchido com zeros (`u:0000000012`) deixa o último desempate determinístico.
2. **Atualização idempotente, nunca incremento:** depois do COMMIT, a API lê do PostgreSQL o total novo do usuário e grava com `ZADD ranking:geral:v2 <score> u:...`. Repetir o comando dá o mesmo resultado; `ZINCRBY` repetido somaria duas vezes.
3. **Reconstrução a partir do SQL:** se a chave não existir ou houver suspeita de divergência, a API reconstrói tudo numa chave temporária e troca com `RENAME` (troca atômica). O PostgreSQL continua sendo a fonte.
4. **Para alta escala, sincronização por eventos** (padrão Event-Driven Sync da especificação): a transação grava também numa tabela `evento_pontuacao` (outbox) e um processo separado aplica no Redis. Se o Redis cair, os eventos esperam e nada se perde.
5. **Mitigação intermediária, sem trocar de estrutura:** guardar no JSON só o top 50 e responder "minha posição" por consulta SQL indexada.

- **Quem decidiu:** Fideles · **Data:** 10/11/2026 · **Situação:** vigente (opção 1 no MVP; itens 1 a 4 como evolução)
