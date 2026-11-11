# Manual do EJ Quest

> Um curso de banco de dados e back-end, contado pelo próprio projeto. Cada capítulo ensina os
> conceitos, mostra onde eles agem no EJ Quest, diz qual requisito da atividade cobrem e como
> reaproveitar em outros projetos. No fim de cada capítulo há um campo **Minhas notas**.

## Como usar

1. **Antes** da sessão de desenvolvimento do dia, leia o capítulo (20 a 30 minutos).
2. **Durante** a sessão, a gente implementa em par. Você pergunta tudo que não fechar.
3. **Depois**, a seção "Como ficou no projeto" do capítulo é atualizada com o código real, e você
   preenche "Minhas notas".
4. Antes da apresentação, releia só as seções **"O que o professor pode perguntar"**.

**Regra de ouro do manual:** ele explica, não legisla. Requisitos e regras moram em
`docs/spec/02-requisitos.md`; aqui eles aparecem pelo ID (RF08, RN09...). Se algo aqui discordar
da spec, vale a spec.

## Mapa do curso

| Cap. | Tema | Quando | Disciplina | Status |
|---|---|---|---|---|
| [00](00-visao-e-arquitetura.md) | Visão geral, persistência poliglota e arquitetura | ter 10/11 | BD2 | ✅ escrito |
| [01](01-ambiente-e-modelagem.md) | Ambiente com Docker e modelagem relacional (ER, 3FN, restrições) | ter 10/11 | BD2 | ✅ escrito |
| 02 | Escrevendo o schema: DDL, tipos, chaves, CHECK e índices | qua 11/11 | BD2 | a escrever |
| 03 | Regras dentro do banco: views, trigger, procedure, ACID, isolamento e `FOR UPDATE` | qua 11/11 | BD2 | a escrever |
| 04 | Carga de 100 mil registros: `generate_series` e reprodutibilidade | qui 12/11 | BD2 | a escrever |
| 05 | Back-end: Express, pool, transação na API, Redis e Cache-Aside | qui 12/11 | BD2 | a escrever |
| 06 | Medir e apresentar: `EXPLAIN`, latência, p95 e o roteiro da AB2 | sex 13/11 | BD2 | a escrever |
| 07 | Front em React: rotas, props, estado, eventos e consumo da API | 15 a 18/11 | PW1 | a escrever |
| 08 | Login de verdade, deploy e README | 18 a 25/11 | PW1 | a escrever |

## Mapa de símbolos

| Marca | Significa |
|---|---|
| 🎯 | Requisito da atividade ou da spec que o tópico cobre |
| 🧠 | Conceito técnico (o que é) |
| 🔧 | Como age no EJ Quest |
| ♻️ | Como reaproveitar em outro projeto |
| ❓ | O que o professor pode perguntar |
| ✍️ | Minhas notas |
