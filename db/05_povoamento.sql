-- =====================================================================================
-- 05_povoamento.sql  |  Carga sintética com mais de 100.000 tentativas (seção 8.2, G-carga)
-- Escrito pelo agente em 12/11/2026 a partir do roteiro do Fideles (DEC-009).
-- Dados inventados: nenhum membro real. E-mails no domínio reservado .test.
-- =====================================================================================
--
-- Cenário: a plataforma atendendo uma rede de EJs, com 6.000 usuários, 3 diretorias,
-- 6 trilhas (3 módulos cada, quiz em todo módulo e desafio no último).
--
-- Reprodutível: semente fixa + data de referência fixa (não usa now()).
-- Rodar de novo gera exatamente a mesma carga, o que permite repetir as medições (RNF10).
--
-- Diferente de uma carga "solta", esta respeita as regras de ordem:
--   - em cada participação, só a ÚLTIMA tentativa pode ser aprovada (RN07);
--   - o desafio só existe para quem concluiu os 3 quizzes da trilha (RN06);
--   - cada participação tem no máximo um envio de desafio aguardando parecer (RN08);
--   - as conclusões passam pela trigger, então os pontos nascem do mesmo jeito que na API.

SET max_parallel_workers_per_gather = 0;   -- random() com semente só é determinístico sem paralelismo
SELECT setseed(0.42);

-- Data de referência da carga ("hoje" da simulação)
CREATE TEMP TABLE ref AS SELECT timestamptz '2026-11-12 12:00:00-03' AS t0;

-- ------------------------------------------------------------------ 1. diretorias
INSERT INTO diretoria (nome) VALUES ('Projetos'), ('Marketing'), ('Gestão de Pessoas');

-- ------------------------------------------------------------------ 2. usuários
-- id 1: gestor geral · ids 2, 3, 4: gestores de Projetos, Marketing e Gestão de Pessoas
-- Login de qualquer usuário da carga: e-mail usuarioN@ejquest.test, senha ejquest123 (só demonstração).
-- ids 5 a 6000: membros. 1 em cada 50 membros está desligado (ativo = false), para o RN17.
INSERT INTO usuario (nome, email, senha_hash, ativo, gestor_geral)
SELECT CASE n
         WHEN 1 THEN 'Gestão Geral'
         WHEN 2 THEN 'Ana Gestora (Projetos)'
         WHEN 3 THEN 'Bruno Gestor (Marketing)'
         WHEN 4 THEN 'Carla Gestora (Gestão de Pessoas)'
         ELSE (ARRAY['Ana','Bruno','Carla','Diego','Elisa','Felipe','Gabriel','Helena','Igor','Júlia',
                     'Kauã','Larissa','Marcos','Natália','Otávio','Paula','Rafael','Sofia','Tiago','Vitória'])[1 + n % 20]
              || ' ' ||
              (ARRAY['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Rodrigues','Almeida','Nascimento',
                     'Araújo','Melo','Barbosa','Ribeiro','Cardoso','Rocha','Dias','Teixeira','Moura','Fideles'])[1 + (n / 20) % 20]
              || ' ' || lpad(n::text, 4, '0')
       END,
       'usuario' || n || '@ejquest.test',
       (SELECT crypt('ejquest123', gen_salt('bf', 8))),   -- senha de demonstração (bcrypt), igual
                                                         -- para todos: o hash é calculado UMA vez
       NOT (n > 4 AND n % 50 = 0),
       n = 1
FROM generate_series(1, 6000) AS n
ORDER BY n;

-- ------------------------------------------------------------------ 3. vínculos
INSERT INTO vinculo_diretoria (id_usuario, id_diretoria, papel)
SELECT n, n - 1, 'gestor' FROM generate_series(2, 4) AS n;

INSERT INTO vinculo_diretoria (id_usuario, id_diretoria, papel)
SELECT u.id_usuario, ((u.id_usuario - 5) % 3) + 1, 'membro'
FROM usuario u WHERE u.id_usuario >= 5;

-- ------------------------------------------------------------------ 4. conteúdo
INSERT INTO trilha (id_diretoria, titulo, descricao, status)
SELECT d, t.titulo, t.descricao, 'publicada'
FROM (VALUES
  (1, 'Fundamentos de Projetos',        'Escopo, requisitos e entrega para clientes reais'),
  (1, 'Desenvolvimento Web na EJ',      'HTML, CSS, React e boas práticas de entrega'),
  (2, 'Marketing Digital para EJs',     'Posicionamento, conteúdo e métricas'),
  (2, 'Vendas Consultivas',             'Prospecção, diagnóstico e proposta comercial'),
  (3, 'Cultura e Liderança',            'Valores, feedback e liderança de equipes'),
  (3, 'Processo Seletivo e Imersão',    'Atração, seleção e integração de trainees')
) AS t(d, titulo, descricao);

INSERT INTO modulo (id_trilha, titulo, ordem)
SELECT tr.id_trilha, 'Módulo ' || o || ' · ' || tr.titulo, o
FROM trilha tr CROSS JOIN generate_series(1, 3) AS o
ORDER BY tr.id_trilha, o;

INSERT INTO licao (id_modulo, titulo, texto, url_externa, ordem)
SELECT mo.id_modulo, 'Lição ' || o, 'Conteúdo da lição ' || o || ' do ' || mo.titulo,
       CASE WHEN o = 2 THEN 'https://exemplo.ejquest.test/material/' || mo.id_modulo END, o
FROM modulo mo CROSS JOIN generate_series(1, 2) AS o
ORDER BY mo.id_modulo, o;

-- Um quiz por módulo (20 pontos, mínimo 70%) e um desafio no último módulo (80 pontos).
INSERT INTO avaliacao (id_modulo, tipo, titulo, instrucoes, pontos_previstos, percentual_minimo)
SELECT mo.id_modulo, 'quiz', 'Quiz do módulo ' || mo.ordem, 'Responda às 3 questões.', 20, 70
FROM modulo mo ORDER BY mo.id_modulo;

INSERT INTO avaliacao (id_modulo, tipo, titulo, instrucoes, pontos_previstos, percentual_minimo)
SELECT mo.id_modulo, 'projeto', 'Desafio final', 'Envie o link do projeto e uma descrição.', 80, NULL
FROM modulo mo WHERE mo.ordem = 3 ORDER BY mo.id_modulo;

INSERT INTO questao (id_avaliacao, enunciado, ordem)
SELECT a.id_avaliacao, 'Questão ' || o || ' do ' || a.titulo, o
FROM avaliacao a CROSS JOIN generate_series(1, 3) AS o
WHERE a.tipo = 'quiz'
ORDER BY a.id_avaliacao, o;

-- 4 alternativas por questão; a correta varia de questão para questão.
INSERT INTO alternativa (id_questao, numero, texto, correta)
SELECT q.id_questao, n, 'Alternativa ' || n, n = (q.id_questao % 4) + 1
FROM questao q CROSS JOIN generate_series(1, 4) AS n
ORDER BY q.id_questao, n;

-- ------------------------------------------------------------------ 5. matrículas
-- Cada membro nas 2 trilhas da sua diretoria, entre 120 e 40 dias antes da referência.
-- Assim a atividade (quizzes a cada 10 dias, desafio depois) termina pouco antes de "hoje".
INSERT INTO matricula (id_usuario, id_trilha, matriculada_em)
SELECT v.id_usuario, tr.id_trilha,
       (SELECT t0 FROM ref) - interval '120 days' + random() * interval '80 days'
FROM vinculo_diretoria v
JOIN trilha tr ON tr.id_diretoria = v.id_diretoria
WHERE v.papel = 'membro'
ORDER BY v.id_usuario, tr.id_trilha;

-- ------------------------------------------------------------------ 6. quizzes
-- Uma participação por matrícula × quiz da trilha.
INSERT INTO participacao_avaliacao (id_matricula, id_avaliacao, iniciada_em)
SELECT m.id_matricula, a.id_avaliacao,
       m.matriculada_em + (mo.ordem - 1) * interval '10 days' + random() * interval '3 days'
FROM matricula m
JOIN modulo mo    ON mo.id_trilha = m.id_trilha
JOIN avaliacao a  ON a.id_modulo  = mo.id_modulo AND a.tipo = 'quiz'
ORDER BY m.id_matricula, mo.ordem;

-- Plano das tentativas de quiz: 1 a 6 por participação (média 3,5).
-- "acertos" = quantas das 3 questões a tentativa acerta. Só a última pode acertar as 3
-- (aprovação = 100%, o único valor >= 70% com 3 questões). Chance de a última aprovar: 85%.
CREATE TEMP TABLE plano_quiz AS
WITH p AS (
    SELECT pa.id_participacao, pa.iniciada_em, 1 + floor(random() * 6)::int AS k
    FROM participacao_avaliacao pa
    JOIN avaliacao a ON a.id_avaliacao = pa.id_avaliacao AND a.tipo = 'quiz'
    ORDER BY pa.id_participacao
)
SELECT p.id_participacao,
       g.n AS numero,
       p.iniciada_em + (g.n - 1) * interval '1 day' + random() * interval '20 hours' AS enviada_em,
       CASE WHEN g.n = p.k AND random() < 0.85 THEN 3
            ELSE floor(random() * 3)::int END AS acertos
FROM p CROSS JOIN LATERAL generate_series(1, p.k) AS g(n)
ORDER BY p.id_participacao, g.n;

INSERT INTO tentativa_avaliacao (id_participacao, numero, enviada_em)
SELECT id_participacao, numero, enviada_em FROM plano_quiz ORDER BY id_participacao, numero;

-- Respostas: a questão de ordem <= acertos recebe a alternativa correta; as outras, uma errada.
INSERT INTO resposta_tentativa (id_tentativa, id_questao, numero_alternativa)
SELECT t.id_tentativa, q.id_questao,
       CASE WHEN q.ordem <= pq.acertos THEN (q.id_questao % 4) + 1
            ELSE ((q.id_questao % 4) + 1) % 4 + 1 END
FROM plano_quiz pq
JOIN tentativa_avaliacao t ON t.id_participacao = pq.id_participacao AND t.numero = pq.numero
JOIN participacao_avaliacao pa ON pa.id_participacao = pq.id_participacao
JOIN questao q ON q.id_avaliacao = pa.id_avaliacao
ORDER BY t.id_tentativa, q.ordem;

-- Resultado do quiz: calculado A PARTIR das respostas gravadas (como o servidor faria).
INSERT INTO resultado_tentativa (id_tentativa, decisao, percentual_acerto, avaliada_em)
SELECT t.id_tentativa,
       CASE WHEN 100.0 * sum((al.correta)::int) / count(*) >= a.percentual_minimo
            THEN 'aprovada' ELSE 'reprovada' END,
       round(100.0 * sum((al.correta)::int) / count(*), 2),
       t.enviada_em + interval '1 minute'
FROM tentativa_avaliacao t
JOIN participacao_avaliacao pa ON pa.id_participacao = t.id_participacao
JOIN avaliacao a               ON a.id_avaliacao     = pa.id_avaliacao AND a.tipo = 'quiz'
JOIN resposta_tentativa r      ON r.id_tentativa     = t.id_tentativa
JOIN alternativa al            ON al.id_questao = r.id_questao AND al.numero = r.numero_alternativa
GROUP BY t.id_tentativa, t.enviada_em, a.percentual_minimo
ORDER BY t.id_tentativa;

-- Conclusões dos quizzes aprovados. A trigger trg_conclusao_pontua grava os 20 pontos.
INSERT INTO conclusao (id_participacao, id_tentativa, concluida_em)
SELECT t.id_participacao, t.id_tentativa, r.avaliada_em
FROM tentativa_avaliacao t
JOIN resultado_tentativa r ON r.id_tentativa = t.id_tentativa AND r.decisao = 'aprovada'
ORDER BY t.id_tentativa;

-- ------------------------------------------------------------------ 7. desafios (projeto)
-- Só para matrículas que concluíram os 3 quizzes da trilha (RN06).
INSERT INTO participacao_avaliacao (id_matricula, id_avaliacao, iniciada_em)
SELECT m.id_matricula, a.id_avaliacao, q.ultima + interval '1 day'
FROM matricula m
JOIN LATERAL (
    SELECT count(*) AS concluidos, max(c.concluida_em) AS ultima
    FROM participacao_avaliacao pa
    JOIN conclusao c ON c.id_participacao = pa.id_participacao
    WHERE pa.id_matricula = m.id_matricula
) q ON q.concluidos = 3
JOIN modulo mo   ON mo.id_trilha = m.id_trilha AND mo.ordem = 3
JOIN avaliacao a ON a.id_modulo  = mo.id_modulo AND a.tipo = 'projeto'
ORDER BY m.id_matricula;

-- 1 a 3 envios por desafio. Os anteriores ao último receberam "ajustes".
-- O último: 50% aprovado, 30% ajustes, 20% ainda aguardando parecer (fila do gestor).
CREATE TEMP TABLE plano_projeto AS
WITH p AS (
    SELECT pa.id_participacao, pa.iniciada_em, tr.id_diretoria,
           1 + floor(random() * 3)::int AS k, random() AS sorte
    FROM participacao_avaliacao pa
    JOIN avaliacao a ON a.id_avaliacao = pa.id_avaliacao AND a.tipo = 'projeto'
    JOIN modulo mo   ON mo.id_modulo   = a.id_modulo
    JOIN trilha tr   ON tr.id_trilha   = mo.id_trilha
    ORDER BY pa.id_participacao
)
SELECT p.id_participacao, g.n AS numero, p.id_diretoria,
       p.iniciada_em + (g.n - 1) * interval '3 days' + random() * interval '1 day' AS enviada_em,
       CASE WHEN g.n < p.k THEN 'ajustes'
            WHEN p.sorte < 0.5 THEN 'aprovada'
            WHEN p.sorte < 0.8 THEN 'ajustes'
            ELSE NULL END AS decisao
FROM p CROSS JOIN LATERAL generate_series(1, p.k) AS g(n)
ORDER BY p.id_participacao, g.n;

INSERT INTO tentativa_avaliacao (id_participacao, numero, enviada_em, link_projeto, descricao_entrega)
SELECT id_participacao, numero, enviada_em,
       'https://github.com/membro-ficticio/desafio-' || id_participacao || '-v' || numero,
       'Entrega ' || numero || ' do desafio'
FROM plano_projeto ORDER BY id_participacao, numero;

-- Parecer do gestor da diretoria da trilha (usuário id_diretoria + 1).
INSERT INTO resultado_tentativa (id_tentativa, id_avaliador, decisao, parecer, avaliada_em)
SELECT t.id_tentativa, pp.id_diretoria + 1, pp.decisao,
       CASE pp.decisao WHEN 'aprovada' THEN 'Entrega aprovada. Bom trabalho.'
                       ELSE 'Ajuste o README e explique as decisões de layout.' END,
       t.enviada_em + interval '1 day'
FROM plano_projeto pp
JOIN tentativa_avaliacao t ON t.id_participacao = pp.id_participacao AND t.numero = pp.numero
WHERE pp.decisao IS NOT NULL
ORDER BY t.id_tentativa;

INSERT INTO conclusao (id_participacao, id_tentativa, concluida_em)
SELECT t.id_participacao, t.id_tentativa, r.avaliada_em
FROM tentativa_avaliacao t
JOIN participacao_avaliacao pa ON pa.id_participacao = t.id_participacao
JOIN avaliacao a               ON a.id_avaliacao = pa.id_avaliacao AND a.tipo = 'projeto'
JOIN resultado_tentativa r     ON r.id_tentativa = t.id_tentativa AND r.decisao = 'aprovada'
ORDER BY t.id_tentativa;

-- ------------------------------------------------------------------ 8. estatísticas e conferência
-- ANALYZE atualiza as estatísticas que o planejador usa para escolher o plano (EXPLAIN).
ANALYZE;

SELECT 'tentativa_avaliacao' AS tabela, count(*) AS linhas FROM tentativa_avaliacao
UNION ALL SELECT 'resposta_tentativa', count(*) FROM resposta_tentativa
UNION ALL SELECT 'resultado_tentativa', count(*) FROM resultado_tentativa
UNION ALL SELECT 'participacao_avaliacao', count(*) FROM participacao_avaliacao
UNION ALL SELECT 'conclusao', count(*) FROM conclusao
UNION ALL SELECT 'pontuacao', count(*) FROM pontuacao
UNION ALL SELECT 'matricula', count(*) FROM matricula
UNION ALL SELECT 'usuario', count(*) FROM usuario
UNION ALL SELECT 'desafios aguardando parecer', count(*) FROM vw_fila_avaliacao;
