# Instruções para agentes e para quem chega no projeto

Este arquivo é o ponto de entrada. Leia antes de qualquer mudança.

## Fonte da verdade

- A especificação em `docs/spec/` manda. O código segue a spec, não o contrário.
- Se a spec não responde, **não invente**: registre a dúvida na seção "Em aberto" de
  `docs/spec/04-plano-e-gates.md` e pergunte ao Fideles.
- Decisões ficam em `docs/spec/decisoes/` (uma por arquivo, `DEC-NNN`). Mudou uma regra? Crie ou
  atualize a decisão **antes** do código.
- O planejamento da AB1 (`planejamento_ab1_bd2.md`, fora do repositório) é **histórico**. Os
  requisitos dele foram trazidos para `docs/spec/02-requisitos.md`, que passa a ser o único lugar
  deles.
- O protótipo no Figma (arquivo "EJ Quest") é a spec visual. A página "Fluxos e notas" liga cada
  tela a requisito, endpoint e tabela.

## Mapa

| Pergunta | Onde |
|---|---|
| Princípios que não se negociam | `docs/spec/00-constituicao.md` |
| O que é, para quem, o que não é | `docs/spec/01-visao.md` |
| Requisitos, regras e critérios de aceite | `docs/spec/02-requisitos.md` |
| Camadas, contrato da API, banco, cache | `docs/spec/03-arquitetura.md` |
| Fases, itens, gates e "Em aberto" | `docs/spec/04-plano-e-gates.md` |
| Quando uma tarefa está pronta | `docs/spec/05-definicao-de-pronto.md` |
| Por que foi decidido assim | `docs/spec/decisoes/` |
| Manual de estudo (o curso do Fideles) | `docs/manual/` |
| Resultados de medição | `docs/resultados/` |

## Convenções

- Tudo em português: spec, código, nomes de tabelas, colunas, variáveis e mensagens de commit.
- `web/` = front React (Vite). `api/` = back-end Node/Express. `db/` = scripts SQL do PostgreSQL.
- O front nunca fala com banco nenhum. Só a API acessa PostgreSQL e Redis.
- SQL escrito à mão com `pg` (sem ORM). Consultas sempre parametrizadas (`$1`, `$2`).
- Commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`. Uma tarefa por commit.
- Nunca subir `.env`, senhas ou tokens.

## Método (para não cair no doom loop)

1. Ler a spec e o item do plano. Mudança que atravessa camadas começa pelo **banco**, depois
   **API**, depois **tela**.
2. Fazer a menor mudança completa. Nada de refatorar o que a tarefa não pede.
3. Pensar no caminho infeliz: Redis fora, PostgreSQL fora, permissão negada, dado duplicado,
   duas requisições ao mesmo tempo.
4. Rodar o que prova o critério (script, `psql`, `curl`) e guardar a evidência. **Sem evidência,
   não passou.**
5. Bug: parar, diagnosticar primeiro (só diagnóstico), depois corrigir só o que o diagnóstico
   mostrou. Duas tentativas sem progresso = parar e conversar.
6. Pacote novo só depois de conferir no npm (autor, downloads, data). Nada de nome inventado.
7. **Trabalho em par:** o Fideles precisa entender cada linha para apresentar. Antes de escrever
   um bloco, explique o que ele faz e qual requisito cobre; depois de escrever, atualize o capítulo
   do manual correspondente (seção "Como ficou no projeto").
