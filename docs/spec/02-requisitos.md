# 02 · Requisitos, regras e critérios de aceite

> Trazido do planejamento da AB1 de BD2 (18/09/2026), que agora é histórico. **Este é o único
> lugar dos requisitos.** O manual e o código citam os IDs daqui.
>
> **Prioridade:** **P0** = entra na AB2 de BD2 (13/11/2026) · **P1** = PW1 (até 25/11/2026) ·
> **P2** = evolução.

## Requisitos funcionais

| ID | Requisito | Critério de aceite | Prio | Telas |
|---|---|---|---|---|
| RF01 | Autenticar usuários ativos e encerrar sessão | Sem sessão ou desligado não acessa recurso protegido | P1 (P0 usa identificação simulada, DEC-004) | 01 |
| RF02 | Administrar usuários, vínculos e permissões | Gestor geral cadastra e desliga; gestor local só atua no próprio escopo | P1 | 13 |
| RF03 | Cadastrar, publicar e arquivar trilhas, módulos e lições | Trilha publicada tem estrutura válida, conteúdo e critérios | P1 | 12 |
| RF04 | Matricular membros nas trilhas | Não existe matrícula duplicada para o mesmo usuário e trilha | P0 no banco (UNIQUE) · P1 na tela | 13 |
| RF05 | Exibir conteúdo textual e links externos | Membro matriculado acessa lições na ordem recomendada | P1 | 03 |
| RF06 | Aplicar quizzes de resposta única | Servidor corrige, registra tentativa e mostra resultado | P0 no banco · P1 na API/tela | 04, 05 |
| RF07 | Receber desafio (projeto) por link e descrição | Nova submissão gera tentativa distinta e mantém as anteriores | **P0** | 06 |
| RF08 | Avaliar desafio e registrar parecer | Aprovação ou ajustes registra responsável e data | **P0** | 10 |
| RF09 | Consultar progresso e pendências | Percentual = avaliações obrigatórias concluídas / exigidas | **P0** (view + endpoint) | 02, 08, 11 |
| RF10 | Exibir portfólio interno | Perfil lista só desafios aprovados, com link e parecer | P1 | 08 |
| RF11 | Conceder pontos e consultar ranking | Cada participação aprovada gera uma recompensa; cache reconstruível | **P0** | 07 |
| RF12 | Preservar histórico e acompanhar membros | Desligamento mantém registros; gestor vê resultados do seu escopo | P0 no banco · P1 na tela | 11, 13 |

## Requisitos não funcionais

| ID | Atributo | Critério verificável | Prio |
|---|---|---|---|
| RNF01 | Integridade | Nenhuma referência órfã nem recompensa duplicada nos testes | **P0** |
| RNF02 | Atomicidade | Falha provocada antes do COMMIT não deixa resultado, conclusão ou pontos pela metade | **P0** |
| RNF03 | Concorrência | Duas aprovações simultâneas da mesma participação → uma conclusão e uma recompensa | **P0** |
| RNF04 | Segurança | Autorização no servidor, senha com hash, consultas parametrizadas | P0 (parametrizadas) · P1 (hash e sessão) |
| RNF05 | Desempenho | Mesma consulta com/sem índice e com cache frio/quente, ambiente registrado | **P0** |
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
| RN05 | Quiz: questões de mesmo peso, uma resposta por questão, mínimo configurado (demo: 70%) | `CHECK` + correção no servidor |
| RN06 | Desafio só depois de aprovado nos quizzes da trilha; lições sem bloqueio | API/procedure |
| RN07 | Novas tentativas após reprovação ou ajustes; participação concluída não recebe envio | Procedure/API |
| RN08 | Só uma tentativa de desafio aguardando parecer por participação | API com bloqueio da participação |
| RN09 | Quiz ou desafio aprovado gera **uma** conclusão e **uma** recompensa | PK em `conclusao` e `pontuacao` + `FOR UPDATE` + trigger |
| RN10 | Pontos fixados antes do uso (demo: 20 por quiz, 80 pelo desafio) | `avaliacao.pontos_previstos` |
| RN11 | Trilha concluída = todas as avaliações obrigatórias aprovadas | `vw_progresso_membro` |
| RN12 | Ranking: usuários ativos com pontos; total desc, última concessão asc, id asc | Consulta sobre `vw_ranking_consolidado` |
| RN13 | O desempate usa o momento da recompensa (aprovação), não o envio | `pontuacao.concedida_em` |
| RN14 | Após a primeira matrícula, estrutura, gabarito e pontos congelam | API (P1) |
| RN15 | Correção textual e troca de link permitidas; conteúdo usado é arquivado, não apagado | API (P1) |
| RN16 | Arquivar impede novas matrículas; rascunho sem vínculo pode ser excluído | API (P1) |
| RN17 | Desligar revoga acesso e tira do ranking, preservando histórico | `usuario.ativo` + FKs `ON DELETE RESTRICT` |
| RN18 | Resultado, conclusão e recompensa são imutáveis no MVP | Sem rota de edição; procedure recusa |

## Fora do compromisso

Ver `01-visao.md`, seção "O que NÃO é".
