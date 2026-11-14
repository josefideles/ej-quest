-- =====================================================================================
-- 03_views.sql  |  Views de ranking, progresso e fila de avaliação
-- Escrito pelo agente em 12/11/2026 a partir do roteiro do Fideles (DEC-009).
-- =====================================================================================
--
-- View comum guarda a CONSULTA, não o resultado. Ela não deixa nada mais rápido: organiza.
-- Quem guarda resultado pronto é a MATERIALIZED VIEW (não usada) ou o cache (Redis).

-- ------------------------------------------------------------------ RANKING (RF11, RN12, RN17)
-- Uma linha por usuário ATIVO que tem pontos. O caminho dos JOINs é o que a 3FN obriga,
-- porque "pontuacao" não guarda o usuário:
--   pontuacao → participacao_avaliacao → matricula → usuario
-- A ORDEM do ranking fica em quem consulta (ORDER BY), não aqui: view não garante ordem.
CREATE VIEW vw_ranking_consolidado AS
SELECT u.id_usuario,
       u.nome,
       SUM(p.pontos)::int    AS total_pontos,
       MAX(p.concedida_em)   AS ultima_concessao
FROM pontuacao p
JOIN participacao_avaliacao pa ON pa.id_participacao = p.id_participacao
JOIN matricula m               ON m.id_matricula     = pa.id_matricula
JOIN usuario u                 ON u.id_usuario       = m.id_usuario
WHERE u.ativo                                   -- RN17: desligado sai do ranking, histórico fica
GROUP BY u.id_usuario, u.nome;

-- ------------------------------------------------------------------ PROGRESSO (RF09, RN11)
-- Uma linha por matrícula: quantas avaliações obrigatórias a trilha exige e quantas o membro
-- já concluiu. Subconsultas separadas evitam a "explosão" de linhas de dois LEFT JOINs.
CREATE VIEW vw_progresso_membro AS
SELECT m.id_matricula,
       m.id_usuario,
       m.id_trilha,
       ex.exigidas                                              AS avaliacoes_exigidas,
       co.concluidas                                            AS avaliacoes_concluidas,
       COALESCE(round(100.0 * co.concluidas / NULLIF(ex.exigidas, 0), 1), 0) AS percentual
FROM matricula m
CROSS JOIN LATERAL (
    SELECT count(*)::int AS exigidas
    FROM avaliacao a
    JOIN modulo mo ON mo.id_modulo = a.id_modulo
    WHERE mo.id_trilha = m.id_trilha AND a.obrigatoria
) ex
CROSS JOIN LATERAL (
    SELECT count(*)::int AS concluidas
    FROM participacao_avaliacao pa
    JOIN conclusao c  ON c.id_participacao = pa.id_participacao
    JOIN avaliacao a  ON a.id_avaliacao    = pa.id_avaliacao
    WHERE pa.id_matricula = m.id_matricula AND a.obrigatoria
) co;

-- ------------------------------------------------------------------ FILA DO GESTOR (RF08, tela 10)
-- Entregas de desafio (projeto) que ainda não receberam parecer, com a diretoria da trilha,
-- para a API filtrar pelo escopo do gestor. "Sem parecer" = não existe linha em resultado
-- (anti-join com NOT EXISTS).
CREATE VIEW vw_fila_avaliacao AS
SELECT t.id_tentativa,
       t.numero,
       t.enviada_em,
       t.link_projeto,
       t.descricao_entrega,
       pa.id_participacao,
       a.id_avaliacao,
       a.titulo        AS avaliacao,
       tr.id_trilha,
       tr.titulo       AS trilha,
       tr.id_diretoria,
       u.id_usuario    AS id_membro,
       u.nome          AS membro
FROM tentativa_avaliacao t
JOIN participacao_avaliacao pa ON pa.id_participacao = t.id_participacao
JOIN avaliacao a               ON a.id_avaliacao     = pa.id_avaliacao
JOIN modulo mo                 ON mo.id_modulo       = a.id_modulo
JOIN trilha tr                 ON tr.id_trilha       = mo.id_trilha
JOIN matricula m               ON m.id_matricula     = pa.id_matricula
JOIN usuario u                 ON u.id_usuario       = m.id_usuario
WHERE a.tipo = 'projeto'
  AND NOT EXISTS (SELECT 1 FROM resultado_tentativa r WHERE r.id_tentativa = t.id_tentativa);
