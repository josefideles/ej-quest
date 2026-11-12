# EJ Quest

Plataforma de gestão do conhecimento gamificada para Empresas Juniores. Projeto de **Banco de
Dados II** (persistência poliglota: PostgreSQL + Redis) e base do back-end de **Programação Web I**.

- **PostgreSQL 16:** fonte oficial (usuários, trilhas, tentativas, conclusões, pontos).
- **Redis 7:** cópia descartável do ranking (Cache-Aside, chave `ranking:geral:v1`, TTL 60 s).
- **API Node.js + Express:** único componente que fala com os dois bancos.

## Como rodar

Requisitos: Docker com Compose, e Node.js 22 (só para rodar o script de medição fora do contêiner).

```bash
cp .env.example .env
docker compose up -d --build
./scripts/recriar-banco.sh
curl http://localhost:3000/saude
```

Testes e medições (cada um guarda a saída em `docs/resultados/`):

```bash
./scripts/testar-banco.sh    # restrições, regras e concorrência real (grava 1 aprovação)
./scripts/testar-api.sh      # todas as rotas, caminho infeliz e Redis fora (grava aprovações)
./scripts/medir-indice.sh    # EXPLAIN com e sem o índice
./scripts/recriar-banco.sh   # volta ao estado limpo da carga
```

Abrir o banco e o cache na mão:

```bash
docker compose exec db psql -U ej_quest -d ej_quest
docker compose exec cache redis-cli
```

Front-end (React + Vite):

```bash
cd web && npm install && npm run dev
```

## Estrutura

```
web/                    front-end React (Vite), veio da AB1 de PW1
docs/spec/              especificação SDD (requisitos, arquitetura, plano e gates, decisões)
docs/manual/            manual de estudo, capítulo por capítulo
db/                     scripts SQL, rodados em ordem pelo recriar-banco.sh
  01_schema.sql         tabelas e restrições (3FN)
  02_indices.sql        índice extra, medido com e sem (DEC-010)
  03_views.sql          vw_ranking_consolidado, vw_progresso_membro, vw_fila_avaliacao
  04_regras.sql         trigger de pontuação; procedures aprovar_projeto, pedir_ajustes, enviar_projeto
  05_povoamento.sql     carga sintética reprodutível (140.574 tentativas)
  testes/               testes de restrições e regras (rodam com ROLLBACK)
api/
  src/index.js          sobe o Express
  src/rotas.js          endpoints (controllers)
  src/db.js             pool de conexões do PostgreSQL
  src/cache.js          cliente Redis tolerante a falha
  src/transacao.js      BEGIN/COMMIT/ROLLBACK numa conexão reservada
  src/erros.js          SQLSTATE do banco → HTTP
  src/servicos/         ranking (Cache-Aside), aprovação e ajustes, envio, progresso e fila
  scripts/medir.js      mediana e p95 de um endpoint
scripts/                recriar-banco, testar-banco, testar-api, medir-indice
docs/resultados/        evidência dos gates (saída dos testes e medições)
docker-compose.yml
```

## Endpoints

A identificação do usuário é **simulada** pelo cabeçalho `X-Usuario-Id` (login real fica para a
etapa de Programação Web I).

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Confere API, PostgreSQL e Redis |
| GET | `/ranking` | Ranking geral (top 100); lê do Redis e, se não houver, do PostgreSQL |
| GET | `/fila` | Entregas de desafio aguardando parecer, no escopo do gestor |
| POST | `/tentativas/:id/aprovar` | Aprova um desafio numa transação; invalida o ranking depois do COMMIT |
| POST | `/tentativas/:id/ajustes` | Pede ajustes com parecer obrigatório |
| POST | `/avaliacoes/:id/tentativas` | Membro envia o link do desafio |
| GET | `/matriculas/:id/progresso` | Progresso e próxima atividade de uma matrícula |

Contrato completo (entradas, saídas e erros): `docs/spec/03-arquitetura.md`.

```bash
curl -H 'X-Usuario-Id: 2' http://localhost:3000/fila
curl -X POST -H 'X-Usuario-Id: 2' -H 'Content-Type: application/json' \
     -d '{"parecer":"Atende aos critérios"}' http://localhost:3000/tentativas/<id>/aprovar
```

Usuários da carga: 1 = gestor geral; 2, 3, 4 = gestores de Projetos, Marketing e Gestão de
Pessoas; 5 a 6000 = membros.

## Medições

```bash
cd api
node scripts/medir.js http://localhost:3000/ranking 30 --frio   # cache sempre vazio
node scripts/medir.js http://localhost:3000/ranking 30          # cache quente
docker compose stop cache                                       # teste de queda do Redis
```

## Documentação

- `AGENTS.md`: regras para quem mexe no código.
- `docs/spec/`: fonte da verdade (requisitos RF/RN/RNF, contrato da API, gates, decisões DEC-xxx).
- `docs/manual/`: manual de estudo do projeto.
- Protótipo: arquivo Figma "EJ Quest" (13 telas, componentes, tokens e mapa tela → requisito → API → banco).
- Histórico: planejamento da AB1 de BD2 (`planejamento_ab1_bd2.md`, fora do repositório).
