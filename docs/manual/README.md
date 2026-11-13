# Manual do EJ Quest

> Um curso de banco de dados e back-end, contado pelo próprio projeto. Cada capítulo ensina os
> conceitos, mostra onde eles agem no EJ Quest, diz qual requisito da atividade cobrem e como
> reaproveitar em outros projetos. No fim de cada capítulo há um campo **Minhas notas**.

## Como usar

1. **Antes** da sessão de desenvolvimento do dia, leia o capítulo (20 a 30 minutos).
2. **Durante** a sessão, a gente implementa em par. Você pergunta tudo que não fechar.
   (Desde 12/11/2026, DEC-009: o agente implementa e o capítulo explica o código já escrito.)
3. **Depois**, a seção "Como ficou no projeto" do capítulo é atualizada com o código real, e você
   preenche "Minhas notas".
4. Antes da apresentação, releia só as seções **"O que o professor pode perguntar"**.

**Regra de ouro do manual:** ele explica, não legisla. Requisitos e regras moram em
`docs/spec/02-requisitos.md`; aqui eles aparecem pelo ID (RF08, RN09...). Se algo aqui discordar
da spec, vale a spec.

## Mapa do curso

| Cap. | Tema | Quando | Disciplina | Status |
|---|---|---|---|---|
| [R](revisao-geral.md) | **Revisão geral pelos materiais de BD2 e PW1** (o que mudou, aulas 5 e 6, Sorted Set, números finais) | qui 12/11 | BD2 e PW1 | ✅ escrito · vale sobre os anteriores |
| [00](00-visao-e-arquitetura.md) | Visão geral, persistência poliglota e arquitetura | ter 10/11 | BD2 | ✅ escrito |
| [01](01-ambiente-e-modelagem.md) | Ambiente com Docker e modelagem relacional (ER, 3FN, restrições) | ter 10/11 | BD2 | ✅ escrito |
| [02](02-schema-e-indices.md) | O schema escrito: DDL, tipos, chaves, CHECK e o índice medido | qui 12/11 | BD2 | ✅ escrito |
| [03](03-regras-no-banco.md) | Regras dentro do banco: views, trigger, procedure, ACID e `FOR UPDATE` | qui 12/11 | BD2 | ✅ escrito |
| [04](04-carga.md) | Carga de 140 mil tentativas: `generate_series` e reprodutibilidade | qui 12/11 | BD2 | ✅ escrito |
| [05](05-api-e-cache.md) | Back-end: Express, pool, transação na API, Redis e Cache-Aside | qui 12/11 | BD2 | ✅ escrito |
| [06](06-medir-e-apresentar.md) | Medir e apresentar: números, roteiro e demo da AB2 | qui 12/11 | BD2 | ✅ escrito |
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
