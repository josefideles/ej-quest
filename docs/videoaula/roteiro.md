# Videoaula do EJ Quest · roteiro e como usar

> Aula narrada que roda no navegador: `docs/videoaula/index.html`. São 34 cenas em 11 módulos,
> com cerca de 3.400 palavras de narração: **uns 23 minutos** na velocidade 1,0.
> Cada cena mostra um visual (código real do projeto, diagrama, tabela ou saída de teste) e é
> narrada em voz alta, com legenda sincronizada. O fim é uma simulação da apresentação ao professor.

## Como assistir

1. Abra `docs/videoaula/index.html` no **Google Chrome** (duplo clique no arquivo ou arraste para o navegador).
2. No seletor **Voz**, escolha uma voz `pt-BR` (no Chrome: "Google português do Brasil").
3. Clique em **▶ Tocar**. A aula avança sozinha de cena em cena.
   - **Espaço** toca ou pausa; **← →** trocam de cena; a velocidade vai de 0,9 a 1,5.
   - Nas cenas da banca, a voz muda de tom: mais grave para o **Professor**, mais aguda para **Você**.
   - O navegador lembra a última cena vista.
4. Sem voz disponível (alguns navegadores no Linux), a legenda avança sozinha no tempo de leitura.

**Por que no navegador e não um arquivo `.mp4`:** nesta máquina não há `ffmpeg` nem programa de voz
instalado, e eu não mandei o texto do projeto para um serviço externo de voz. A síntese de voz do
navegador resolve sem instalar nada. Atenção: as vozes "Google" do Chrome usam a internet (o texto
da fala vai para o Google); as vozes locais do sistema, quando existem, não.

**Para virar um vídeo de verdade** (por exemplo, para o entregável 3 de BD2): grave a tela com o
OBS Studio (captura de janela + áudio da área de trabalho) enquanto a aula toca. A gravação nativa
do GNOME (Ctrl + Alt + Shift + R) não grava o áudio.

## Estrutura

| # | Módulo | Cenas | Conteúdo | Conceitos da disciplina | Arquivos mostrados |
|---|---|---|---|---|---|
| 1 | Abertura | 1 | Mapa da aula | - | - |
| 2 | Visão | 2 a 6 | Problema, poliglota, camadas, estrutura, execução | Persistência poliglota; MVC/Layered (espec. 3.1); Docker Compose | `docker-compose.yml`, `scripts/recriar-banco.sh` |
| 3 | Modelagem | 7 a 9 | 16 tabelas, `participacao_avaliacao`, 3FN | MER → relacional, 1:N, N:N (aula 2); 1FN a 3FN | Diagrama ER |
| 4 | Schema | 10 a 13 | Restrições, FK composta, NULL no CHECK, índice | PK, FK, UNIQUE, CHECK; índice parcial e em expressão; EXPLAIN | `db/01_schema.sql`, `db/02_indices.sql`, `indice.txt` |
| 5 | Regras no banco | 14 a 17 | Views, trigger AFTER, trigger BEFORE, procedure | Views, procedures (IN, INOUT), triggers (BEFORE/AFTER, OLD/NEW), trigger × constraint (aula 5) | `db/03_views.sql`, `db/04_regras.sql` |
| 6 | Transações | 18 a 21 | ACID, lost update, duas sessões, isolamento | ACID, anomalias, níveis de isolamento, locks S/X, Strict 2PL, deadlock, WAL e recuperação (aula 6) | `testes-banco.txt`, consulta `pg_blocking_pids` |
| 7 | Carga | 22 | 140 mil tentativas | `generate_series`, `LATERAL`, reprodutibilidade | `db/05_povoamento.sql` |
| 8 | API | 23 e 24 | Requisição de ponta a ponta, transação | API REST, pool, transação na aplicação, SQL injection (contraste com a aula 12 de PW1) | `api/src/` |
| 9 | Redis | 25 a 27 | Cache-Aside, Sorted Set, Redis fora | Padrões de sincronização: Cache-Aside e Write-Through (espec. de BD2) | `placar-redis.js`, `testes-api.txt` |
| 10 | Prova | 28 e 29 | Testes e números | Comparação com e sem índice e cache; vazão | `docs/resultados/` |
| 11 | Simulação da banca | 30 a 33 | Abertura na sua voz, 8 perguntas, recortes | Tudo acima, em forma de resposta curta | - |
| - | Encerramento | 34 | Como estudar até a apresentação | - | - |

## Como usar para estudar

1. **Primeira vez:** assista inteiro, sem pausar, para ter o mapa.
2. **Segunda vez:** pause em cada cena de código e leia o arquivo de verdade no editor, ao lado.
3. **Banca (cenas 31 e 32):** pause depois de cada "Professor:" e responda você, em voz alta, antes de ouvir a resposta.
4. **Antes de apresentar:** cenas 20, 26, 29 e 30. São a demo, o Redis, os números e a abertura.

## Fonte de cada cena

O texto das falas está no próprio `index.html` (lista `CENAS`), e cada visual está num
`<template id="v-...">`. Para corrigir uma fala ou um número, edite ali. Os números das cenas 13 e
29 são os da rodada final de 12/11/2026 (`docs/resultados/indice.txt` e `cache.txt`), os mesmos da
seção R.8 da revisão geral do manual.
