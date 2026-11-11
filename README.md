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
  02_indices.sql        índices extras, medidos com e sem
  03_views.sql          vw_ranking_consolidado, vw_progresso_membro
  04_regras.sql         trigger de pontuação e procedure aprovar_projeto
  05_povoamento.sql     carga sintética (>= 100.000 tentativas)
api/
  src/index.js          sobe o Express
  src/rotas.js          endpoints (controllers)
  src/db.js             pool de conexões do PostgreSQL
  src/cache.js          cliente Redis tolerante a falha
  src/servicos/         regra de negócio: ranking (Cache-Aside) e aprovação (transação)
  scripts/medir.js      mediana e p95 de um endpoint
scripts/recriar-banco.sh
docker-compose.yml
```

## Endpoints

A identificação do usuário é **simulada** pelo cabeçalho `X-Usuario-Id` (login real fica para a
etapa de Programação Web I).

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Confere API e PostgreSQL |
| GET | `/ranking` | Ranking geral; lê do Redis e, se não houver, do PostgreSQL |
| POST | `/tentativas/:id/aprovar` | Aprova um projeto numa transação; invalida o ranking depois do COMMIT |

```bash
curl -H 'X-Usuario-Id: 1' http://localhost:3000/ranking
curl -X POST -H 'X-Usuario-Id: 1' -H 'Content-Type: application/json' \
     -d '{"parecer":"Atende aos critérios"}' http://localhost:3000/tentativas/10/aprovar
```

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
