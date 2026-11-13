# EJ Quest

Plataforma de gestão do conhecimento gamificada para Empresas Juniores: trilhas de capacitação com
lições, quizzes e um desafio final avaliado pelo gestor; cada aprovação gera pontos e alimenta um
ranking. Projeto prático de **Banco de Dados II** (persistência poliglota) e base do back-end de
**Programação Web I** · UFAL, Unidade Educacional Penedo · 2026.2.

- **PostgreSQL 16:** fonte oficial. 16 tabelas em 3FN, restrições, views, procedures e triggers.
- **Redis 7:** cópias derivadas do ranking. Top 100 em **Cache-Aside** e placar em **Sorted Set** com **Write-Through**.
- **API REST em Node.js 22 + Express:** único componente que acessa os dois bancos.

**Relatório completo da AB2 de BD2:** [`docs/relatorio/RELATORIO.md`](docs/relatorio/RELATORIO.md)
(também em PDF na mesma pasta).

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
Portas usadas na sua máquina: **5433** (PostgreSQL), **6380** (Redis) e **3000** (API).

### 2. Subir tudo (um comando)

```bash
git clone https://github.com/josefideles/ej-quest.git
cd ej-quest
docker compose up -d --build
```

Na **primeira** subida, o PostgreSQL cria as tabelas e a carga de **140.574 tentativas** sozinho
(roda `db/01` a `db/05`). Leva cerca de 1 minuto. O `.env` é **opcional**: sem ele, valem os padrões.

### 3. Conferir

```bash
docker compose ps                     # db precisa estar "healthy"; api e cache "running"
curl http://localhost:3000/saude      # {"api":"ok","postgres":"ok","redis":"ok"}
```

Entrar com um usuário da carga (todos usam a senha de demonstração `ejquest123`):

```bash
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" \
     -d '{"email":"usuario2@ejquest.test","senha":"ejquest123"}'
```

| Usuário | Papel |
|---|---|
| `usuario1@ejquest.test` | Gestor geral |
| `usuario2@ejquest.test`, `usuario3@...`, `usuario4@...` | Gestores de Projetos, Marketing e Gestão de Pessoas |
| `usuario5@ejquest.test` a `usuario6000@ejquest.test` | Membros (1 em cada 50 está desligado e não entra) |

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

### 5. Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `port is already allocated` | Porta 5433, 6380 ou 3000 ocupada | `cp .env.example .env`, troque `PORTA_POSTGRES`, `PORTA_REDIS` ou `PORTA_API` e suba de novo |
| `db` fica em `starting` por ~1 min | É a carga inicial rodando | Espere ou acompanhe com `docker compose logs -f db` |
| `/saude` responde `postgres: indisponível` | O banco ainda não terminou a carga | Espere o `db` ficar `healthy` |
| `\r: command not found` ao rodar um script | Arquivo com fim de linha do Windows | O `.gitattributes` evita isso num clone novo. Se aparecer, clone o repositório de novo |
| `permission denied` ao rodar um script | Script sem permissão de execução | `chmod +x scripts/*.sh` ou `bash scripts/testar-banco.sh` |
| Quero começar do zero | - | `docker compose down -v` e `docker compose up -d --build` |
| `password authentication failed` | Volume antigo criado com outra senha | `docker compose down -v` e suba de novo |

### 6. Desligar

```bash
docker compose down        # desliga; os dados ficam no volume
docker compose down -v     # desliga e apaga o banco
```

---

## Endpoints

Autenticação: `POST /login` devolve um token; envie `Authorization: Bearer <token>` nas demais rotas.
Em modo demonstração (padrão local), os scripts usam o cabeçalho `X-Usuario-Id` (DEC-014).

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Confere API, PostgreSQL e Redis |
| POST | `/login` · `/logout` | Entra (bcrypt no banco, token assinado) · sai |
| GET | `/eu` · `/eu/portfolio` | Perfil · desafios aprovados com link e parecer |
| GET | `/trilhas/:id` | Módulos, lições e status das avaliações para quem pediu |
| GET | `/avaliacoes/:id` | Quiz para responder, **sem** gabarito |
| POST | `/avaliacoes/:id/respostas` | Envia o quiz; o banco corrige e, se aprovado, dá os pontos |
| POST | `/avaliacoes/:id/tentativas` | Envia o link do desafio final |
| GET | `/fila` | Entregas aguardando parecer no escopo do gestor |
| POST | `/tentativas/:id/aprovar` · `/ajustes` | Parecer do gestor (transação com `FOR UPDATE`) |
| GET | `/matriculas/:id/progresso` | Progresso e próxima atividade |
| GET | `/ranking` · `/ranking/eu` | Top 100 (Cache-Aside) · minha posição (Sorted Set) |

Contrato completo, com entradas, saídas e erros: [`docs/spec/03-arquitetura.md`](docs/spec/03-arquitetura.md).

## Estrutura

```
db/                     SQL, rodado em ordem na primeira subida
  01_schema.sql         16 tabelas e restrições (3FN), extensão pgcrypto
  02_indices.sql        índice extra, escolhido por medição (DEC-010)
  03_views.sql          vw_ranking_consolidado, vw_progresso_membro, vw_fila_avaliacao
  04_regras.sql         triggers e procedures sp_ (aprovar, ajustes, enviar, responder quiz), login
  05_povoamento.sql     carga sintética reprodutível (semente 0,42)
  testes/               testes de restrições e regras (rodam com ROLLBACK)
api/src/                Node.js + Express
  rotas.js              Controllers
  servicos/             Services: regra, transação e sincronização com o Redis
  repositorios/         Repositories: todo o SQL (postgres.js) e o Sorted Set (placar-redis.js)
  cache.js              Repository do Redis (strings com TTL), tolerante a falha
  autenticacao.js       token assinado e identificação
  transacao.js · erros.js
scripts/                subir, testar, medir e conferir
docs/
  relatorio/            relatório da AB2 de BD2
  arquitetura-e-modelagem.md   ER, modelo chave-valor e justificativa
  spec/                 especificação SDD: requisitos, arquitetura, plano, decisões DEC-001 a DEC-014
  resultados/           saída dos testes e das medições (evidências)
  manual/ · videoaula/  material de estudo do autor
web/                    front-end React (Vite), em desenvolvimento para Programação Web I
docker-compose.yml
```
