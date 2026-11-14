# EJ Quest

Plataforma de gestão do conhecimento gamificada para Empresas Juniores: trilhas de capacitação com
lições, quizzes e um desafio final avaliado pelo gestor; cada aprovação gera pontos e alimenta um
ranking. Projeto prático de **Banco de Dados II** (persistência poliglota) e base do back-end de
**Programação Web I** · UFAL, Unidade Educacional Penedo · 2026.2.

- **PostgreSQL 16:** fonte oficial. 16 tabelas em 3FN, restrições, views, procedures e triggers.
- **Redis 7:** cópias derivadas do ranking. Top 100 em **Cache-Aside** e placar em **Sorted Set** com **Write-Through**.
- **API REST em Node.js 22 + Express (`server/`):** único componente que acessa os dois bancos.

- **Front-end em React + Vite (`client/`):** telas do protótipo (login, jornada, lição, quiz, desafio, ranking, perfil e gestão), servidas por nginx.

---

## Como rodar

### 1. Pré-requisitos

| Item | Versão testada | Observação |
|---|---|---|
| Docker Engine ou Docker Desktop | 29.x | Linux, Windows ou macOS |
| Docker Compose **v2** (comando `docker compose`, com espaço) | 2.x | O antigo `docker-compose` (com hífen) não é suportado |
| Git | qualquer | Para clonar |
| Bash e curl | qualquer | **Só para os scripts de teste.** No Windows, use o **Git Bash** ou o WSL |

Não é preciso instalar PostgreSQL, Redis, Node.js nem Python: tudo roda dentro dos contêineres.
Portas usadas na sua máquina: **8080** (front), **3000** (API), **5433** (PostgreSQL) e **6380** (Redis).

### 2. Subir tudo (um comando)

```bash
git clone https://github.com/josefideles/ej-quest.git
cd ej-quest
docker compose up -d --build
```

Na **primeira** subida, o PostgreSQL cria as tabelas e a carga de **140.574 tentativas** sozinho
(roda `db/01` a `db/05`). Leva cerca de 1 minuto. O `.env` é **opcional**: sem ele, valem os padrões.

### 3. Abrir no navegador

Acesse **http://localhost:8080**. Todos os usuários da carga usam a senha de demonstração `ejquest123`.

| Para ver | Entre com | O que fazer |
|---|---|---|
| Fluxo do membro | `usuario172@ejquest.test` | Jornada → lição → quiz → resultado; ranking e perfil na barra de navegação |
| Desafio (projeto prático) | `usuario13@ejquest.test` | Jornada → Desafio final → enviar uma nova entrega |
| Gestão e avaliação | `usuario4@ejquest.test` (gestora de Gestão de Pessoas) | Aba Gestão → Avaliar → aprovar ou pedir ajustes |
| Gestor geral | `usuario1@ejquest.test` | Gestão de todas as diretorias |

| Usuário | Papel |
|---|---|
| `usuario1@ejquest.test` | Gestor geral |
| `usuario2@`, `usuario3@`, `usuario4@ejquest.test` | Gestores de Projetos, Marketing e Gestão de Pessoas |
| `usuario5@ejquest.test` a `usuario6000@ejquest.test` | Membros (1 em cada 50 está desligado e não entra) |

Conferência pelo terminal (opcional):

```bash
docker compose ps                     # db "healthy"; api, cache e client "running"
curl http://localhost:3000/saude      # {"api":"ok","postgres":"ok","redis":"ok"}
```

### 4. Rodar os testes e as medições (Bash)

Cada script guarda a saída em `docs/resultados/`.

```bash
./scripts/testar-banco.sh     # restrições, regras, imutabilidade e concorrência real (duas sessões)
./scripts/testar-api.sh       # login, estudo, quiz, aprovação, ranking, Redis fora
./scripts/conferir-placar.sh  # placar do Redis idêntico ao ranking do PostgreSQL
./scripts/medir-indice.sh     # EXPLAIN (ANALYZE) com e sem o índice
./scripts/medir-cache.sh      # latência e vazão (req/s) com e sem Redis
./scripts/recriar-banco.sh    # volta ao estado limpo da carga (os testes gravam dados)
```

Etapas do banco de forma individual (estrutura, povoamento e testes separados):

```bash
./scripts/recriar-banco.sh sem-povoamento   # só a estrutura: 01_schema, 02_indices, 03_views, 04_regras
./scripts/rodar-sql.sh 05_povoamento.sql    # só o povoamento (carga sintética)
./scripts/rodar-sql.sh 03_views.sql         # qualquer arquivo de db/, um por vez
```

### 5. Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `port is already allocated` | Porta 8080, 3000, 5433 ou 6380 ocupada | `cp .env.example .env`, troque `PORTA_WEB`, `PORTA_API`, `PORTA_POSTGRES` ou `PORTA_REDIS` e suba de novo |
| `db` fica em `starting` por ~1 min | É a carga inicial rodando | Espere ou acompanhe com `docker compose logs -f db` |
| `/saude` responde `postgres: indisponível` | O banco ainda não terminou a carga | Espere o `db` ficar `healthy` |
| `\r: command not found` ao rodar um script | Arquivo com fim de linha do Windows | O `.gitattributes` evita isso num clone novo. Se aparecer, clone o repositório de novo |
| `permission denied` ao rodar um script | Script sem permissão de execução | `chmod +x scripts/*.sh` ou `bash scripts/testar-banco.sh` |
| Quero começar do zero | - | `docker compose down -v` e `docker compose up -d --build` |
| `password authentication failed` | Volume antigo criado com outra senha | `docker compose down -v` e suba de novo |

### 6. Desligar

```bash
docker compose stop        # pausa os contêineres (volta com docker compose start)
docker compose down        # desliga e remove os contêineres; os dados ficam no volume
docker compose down -v     # desliga e apaga o banco (na próxima subida, a carga é refeita)
```

---

## Endpoints

Autenticação: `POST /login` devolve um token; envie `Authorization: Bearer <token>` nas demais rotas.
Em modo demonstração (padrão local), os scripts de teste usam o cabeçalho `X-Usuario-Id`. No front, as rotas ficam sob `/api` (o nginx repassa para a API).

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Confere API, PostgreSQL e Redis |
| POST | `/login` · `/logout` | Entra (bcrypt no banco, token assinado) · sai |
| GET | `/eu` · `/eu/portfolio` | Perfil · desafios aprovados com link e parecer |
| GET | `/trilhas/:id` | Módulos, lições e status das avaliações para quem pediu |
| GET | `/avaliacoes/:id` | Quiz para responder, **sem** gabarito |
| POST | `/avaliacoes/:id/respostas` | Envia o quiz; o banco corrige e, se aprovado, dá os pontos |
| POST | `/avaliacoes/:id/tentativas` | Envia o link do desafio final |
| GET | `/avaliacoes/:id/minhas-tentativas` | Histórico das minhas entregas, com decisão e parecer |
| GET | `/fila` | Entregas aguardando parecer no escopo do gestor |
| GET | `/gestao/resumo` | Números da diretoria e progresso dos membros (painel do gestor) |
| POST | `/tentativas/:id/aprovar` · `/ajustes` | Parecer do gestor (transação com `FOR UPDATE`) |
| GET | `/matriculas/:id/progresso` | Progresso e próxima atividade |
| GET | `/ranking` · `/ranking/eu` | Top 100 (Cache-Aside) · minha posição (Sorted Set) |

## Estrutura

```
client/                 front-end React + Vite (React Router, axios, react-icons)
  src/pages/            uma página por tela do protótipo (01 a 11)
  src/components/       moldura (barra superior e navegação), mascote, peças reutilizáveis
  src/api.js            cliente axios: token no cabeçalho, chamadas em /api
  Dockerfile · nginx.conf   build estático servido pelo nginx, que repassa /api para a API
server/src/             back-end Node.js + Express (monólito em camadas)
  rotas.js              Controllers
  servicos/             Services: regra, transação e sincronização com o Redis
  repositorios/         Repositories: todo o SQL (postgres.js) e o Sorted Set (placar-redis.js)
  cache.js              Repository do Redis (strings com TTL), tolerante a falha
  autenticacao.js       token assinado e identificação
  transacao.js · erros.js
server/scripts/medir.js medidor de latência e vazão (roda dentro do contêiner da API)
db/                     SQL, rodado em ordem na primeira subida
  01_schema.sql         16 tabelas e restrições (3FN), extensão pgcrypto
  02_indices.sql        índice extra, escolhido por medição
  03_views.sql          vw_ranking_consolidado, vw_progresso_membro, vw_fila_avaliacao
  04_regras.sql         triggers e procedures sp_ (aprovar, ajustes, enviar, responder quiz), login
  05_povoamento.sql     carga sintética reprodutível (semente 0,42)
  testes/               testes de restrições e regras (rodam com ROLLBACK)
scripts/                subir, testar, medir e conferir
docs/
  arquitetura-e-modelagem.md   ER, modelo chave-valor e justificativa
  resultados/           saída dos testes e das medições (evidências)
docker-compose.yml      db (PostgreSQL), cache (Redis), api e client
```
