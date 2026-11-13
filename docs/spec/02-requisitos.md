# 02 · Requisitos, regras e critérios de aceite

> Trazido do planejamento da AB1 de BD2 (18/09/2026), que agora é histórico. **Este é o único
> lugar dos requisitos.** O manual e o código citam os IDs daqui.
>
> **Prioridade:** **P0** = entra na AB2 de BD2 (13/11/2026) · **P1** = PW1 (até 25/11/2026) ·
> **P2** = evolução.

## Requisitos funcionais

| ID | Requisito | Critério de aceite | Prio | Telas |
|---|---|---|---|---|
| RF01 | Autenticar usuários ativos e encerrar sessão | Sem sessão ou desligado não acessa recurso protegido | **P0** na API (DEC-014) · P1 na tela | 01 |
| RF02 | Administrar usuários, vínculos e permissões | Gestor geral cadastra e desliga; gestor local só atua no próprio escopo | P1 | 13 |
| RF03 | Cadastrar, publicar e arquivar trilhas, módulos e lições | Trilha publicada tem estrutura válida, conteúdo e critérios | P1 | 12 |
| RF04 | Matricular membros nas trilhas | Não existe matrícula duplicada para o mesmo usuário e trilha | P0 no banco (UNIQUE) · P1 na tela | 13 |
| RF05 | Exibir conteúdo textual e links externos | Membro matriculado acessa lições na ordem recomendada | **P0** na API (`GET /trilhas/:id`) · P1 na tela | 03 |
| RF06 | Aplicar quizzes de resposta única | Servidor corrige, registra tentativa e mostra resultado | **P0** no banco e na API (`sp_responder_quiz`) · P1 na tela | 04, 05 |
| RF07 | Receber desafio (projeto) por link e descrição | Nova submissão gera tentativa distinta e mantém as anteriores | **P0** | 06 |
| RF08 | Avaliar desafio e registrar parecer | Aprovação ou ajustes registra responsável e data | **P0** | 10 |
| RF09 | Consultar progresso e pendências | Percentual = avaliações obrigatórias concluídas / exigidas | **P0** (view + endpoint) | 02, 08, 11 |
| RF10 | Exibir portfólio interno | Perfil lista só desafios aprovados, com link e parecer | **P0** na API (`GET /eu/portfolio`) · P1 na tela | 08 |
| RF11 | Conceder pontos e consultar ranking | Cada participação aprovada gera uma recompensa; top 100 e posição do usuário; cache e placar reconstruíveis do SQL e iguais a ele | **P0** | 07 |
| RF12 | Preservar histórico e acompanhar membros | Desligamento mantém registros; gestor vê resultados do seu escopo | P0 no banco · P1 na tela | 11, 13 |

## Requisitos não funcionais

| ID | Atributo | Critério verificável | Prio |
|---|---|---|---|
| RNF01 | Integridade | Nenhuma referência órfã nem recompensa duplicada nos testes | **P0** |
| RNF02 | Atomicidade | Falha provocada antes do COMMIT não deixa resultado, conclusão ou pontos pela metade | **P0** |
| RNF03 | Concorrência | Duas aprovações simultâneas da mesma participação → uma conclusão e uma recompensa | **P0** |
| RNF04 | Segurança | Autorização no servidor, senha com hash, consultas parametrizadas | **P0** (bcrypt via pgcrypto, token assinado, parametrizadas) |
| RNF05 | Desempenho | Mesma consulta com/sem índice e com cache frio/quente; vazão (req/s) com e sem Redis; ambiente registrado | **P0** |
| RNF06 | Continuidade sem cache | Redis fora não impede aprovação nem consulta pelo PostgreSQL | **P0** |
| RNF07 | Rastreabilidade | Tentativas, resultados, avaliadores e origem dos pontos identificáveis | **P0** |
| RNF08 | Usabilidade | Usuário identifica a próxima atividade, o resultado do envio e o que fazer após feedback | P1 |
| RNF09 | Acessibilidade e responsividade | Teclado, rótulos nos campos, foco visível, estado não só por cor | P1 |
| RNF10 | Reprodutibilidade | Ambiente, carga e experimentos documentados para rodar de novo | **P0** |
| RNF11 | Custo zero | Sem hospedagem, domínio, e-mail ou licença paga no cenário local | **P0** |

## Regras de negócio

| ID | Regra | Onde é garantida |
|---|---|---|
| RN01 | Cadastro único; e-mail único e normalizado | Índice único em `lower(email)` |
| RN02 | Cadastro, delegação e desligamento só pelo gestor geral; sem registro público | API (P1) |
| RN03 | Publicar exige lições, um quiz por módulo e um desafio no último módulo, com critérios | API ao publicar (P1) |
| RN04 | Matrícula única por usuário e trilha; participação única por matrícula e avaliação | `UNIQUE` nas duas tabelas |
| RN05 | Quiz: questões de mesmo peso, uma resposta por questão, mínimo configurado (demo: 70%) | `CHECK`, PK de `resposta_tentativa` e correção em `sp_responder_quiz` |
| RN06 | Desafio só depois de aprovado nos quizzes da trilha; lições sem bloqueio | `sp_enviar_projeto` |
| RN07 | Novas tentativas após reprovação ou ajustes; participação concluída não recebe envio | `sp_enviar_projeto` e `sp_pedir_ajustes` |
| RN08 | Só uma tentativa de desafio aguardando parecer por participação | `sp_enviar_projeto` com `FOR UPDATE` na participação |
| RN09 | Quiz ou desafio aprovado gera **uma** conclusão e **uma** recompensa | PK em `conclusao` e `pontuacao` + `FOR UPDATE` + trigger |
| RN10 | Pontos fixados antes do uso (demo: 20 por quiz, 80 pelo desafio) | `avaliacao.pontos_previstos` |
| RN11 | Trilha concluída = todas as avaliações obrigatórias aprovadas | `vw_progresso_membro` |
| RN12 | Ranking: usuários ativos com pontos; total desc, última concessão asc, id asc | Consulta sobre `vw_ranking_consolidado` |
| RN13 | O desempate usa o momento da recompensa (aprovação), não o envio | `pontuacao.concedida_em` |
| RN14 | Após a primeira matrícula, estrutura, gabarito e pontos congelam | API (P1) |
| RN15 | Correção textual e troca de link permitidas; conteúdo usado é arquivado, não apagado | API (P1) |
| RN16 | Arquivar impede novas matrículas; rascunho sem vínculo pode ser excluído | API (P1) |
| RN17 | Desligar revoga acesso e tira do ranking, preservando histórico | `usuario.ativo` + FKs `ON DELETE RESTRICT` |
| RN18 | Resultado, conclusão e recompensa são imutáveis no MVP | Triggers `BEFORE UPDATE OR DELETE` nas três tabelas (DEC-011) |

## Requisitos das disciplinas (o que cada professor avalia)

### BD2 · "Especificação de Projeto: Banco de Dados II"

| Exigência | Onde está | Evidência |
|---|---|---|
| Relacional + NoSQL com divisão justificável | PostgreSQL + Redis | `docs/arquitetura-e-modelagem.md` |
| Modelagem normalizada até 3FN | `db/01_schema.sql` | Manual, cap. 1.6 |
| Transações ACID, restrições, índices, views, procedures e triggers | `db/01` a `04` | `testes-banco.txt` |
| NoSQL com justificativa técnica (caching de alta velocidade, leaderboard) | `ranking:geral:v1`, `ranking:placar:v1` | DEC-005, DEC-012 |
| API REST que orquestra os dois bancos | `api/` | `testes-api.txt` |
| Padrões de sincronização SQL/NoSQL | Cache-Aside (top 100) e Write-Through (placar) | `testes-api.txt`, `conferir-placar.sh` |
| Scripts DDL/DML e rotinas NoSQL | `db/*.sql`, `api/src/repositorios/` | - |
| Povoamento com ≥ 100.000 registros na entidade principal | 140.574 tentativas | `db/05_povoamento.sql` |
| Comparação com e sem índice e com e sem cache | `medir-indice.sh`, `medir-cache.sh` | `indice.txt`, `cache.txt` |
| Entregável 1: ER, diagrama de coleções e justificativa | `docs/arquitetura-e-modelagem.md` | - |
| Entregável 2: repositório com scripts, API e Docker Compose | este repositório | README |
| Entregável 3: vídeo/apresentação com carga, consistência e vazão | Manual, cap. 6 e revisão geral | `docs/videoaula/` |
| Projeto "em equipes" | Fideles faz individual (decisão dele, 10/11/2026) | - |

### PW1 · "Descrição do projeto - AB2" (Tabela 1)

| Exigência | Como o EJ Quest atende | Prio |
|---|---|---|
| Página HTML inicial dividida em partes | Layout com topo, navegação e conteúdo (componentes) | P1 |
| Comandos de locomoção dos componentes | Flexbox nos layouts (aulas 3 e atividade de Flexbox) | P1 |
| Estilização em texto e em imagens | CSS das telas do protótipo, avatar e ilustrações | P1 |
| Rotas para páginas diferentes | `react-router-dom`: Jornada, Ranking, Perfil, Avaliar | P1 |
| Props | Componentes de card, nó da trilha e linha do ranking recebendo dados | P1 |
| Biblioteca de ícones do React | `react-icons` na navegação e nos status | P1 |
| Eventos onChange e onClick | Formulário de envio do desafio e parecer do gestor | P1 |
| useState e renderização condicional | Estados de carregando, vazio, erro e permissão; abas | P1 |
| Conexão com banco de dados | O front chama a API (`axios` + `useEffect`), que acessa PostgreSQL e Redis | P1 |
| Trello, GitHub e README | Quadro no Trello, repositório público, README com execução | P1 |
| Sistema final online | Deploy a definir, mantendo custo zero (ver "Em aberto" no plano) | P1 |

## Fora do compromisso

Ver `01-visao.md`, seção "O que NÃO é".
