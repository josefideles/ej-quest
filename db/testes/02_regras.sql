-- =====================================================================================
-- testes/02_regras.sql  |  Gate G-regra: aprovação atômica, única e com permissão
-- Roda dentro de BEGIN ... ROLLBACK: o banco volta exatamente como estava.
-- A concorrência real (duas sessões) está em scripts/testar-banco.sh.
-- =====================================================================================
\set QUIET on
\pset footer off
BEGIN;

-- Uma entrega de desafio aguardando parecer, o dono e a diretoria da trilha.
SELECT id_tentativa AS t, id_participacao AS p, id_avaliacao AS desafio_dono, id_membro AS dono,
       id_diretoria AS dir, id_diretoria + 1 AS gestor, (id_diretoria % 3) + 2 AS outro_gestor
FROM vw_fila_avaliacao ORDER BY id_tentativa LIMIT 1 \gset

-- Um quiz qualquer (quiz não recebe parecer de gestor)
SELECT t.id_tentativa AS t_quiz FROM tentativa_avaliacao t
JOIN participacao_avaliacao pa USING (id_participacao)
JOIN avaliacao a USING (id_avaliacao) WHERE a.tipo = 'quiz' LIMIT 1 \gset

\echo 'Entrega usada no teste: tentativa' :t ', participação' :p ', dono' :dono ', gestor' :gestor

CREATE FUNCTION pg_temp.deve_falhar(p_caso text, p_sql text) RETURNS TABLE (caso text, resultado text)
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE p_sql;
    RETURN QUERY SELECT p_caso, 'FALHOU: o banco aceitou'::text;
EXCEPTION WHEN others THEN
    RETURN QUERY SELECT p_caso, 'OK, recusado [' || SQLSTATE || ']: ' || SQLERRM;
END;
$$;

\echo ''
\echo '--- Permissão e estado (procedure recusa)'
SELECT * FROM pg_temp.deve_falhar('autoaprovação (o dono aprova a própria entrega)',
  format('CALL sp_aprovar_projeto(%s, %s, %L)', :t, :dono, 'eu mesmo'))
UNION ALL SELECT * FROM pg_temp.deve_falhar('gestor de OUTRA diretoria aprova',
  format('CALL sp_aprovar_projeto(%s, %s, %L)', :t, :outro_gestor, 'ok'))
UNION ALL SELECT * FROM pg_temp.deve_falhar('aprovar uma tentativa de quiz',
  format('CALL sp_aprovar_projeto(%s, %s, %L)', :t_quiz, 1, 'ok'))
UNION ALL SELECT * FROM pg_temp.deve_falhar('aprovar tentativa que não existe',
  format('CALL sp_aprovar_projeto(%s, %s, %L)', 99999999, 1, 'ok'))
UNION ALL SELECT * FROM pg_temp.deve_falhar('pedir ajustes sem parecer',
  format('CALL sp_pedir_ajustes(%s, %s, %L)', :t, :gestor, ''))
UNION ALL SELECT * FROM pg_temp.deve_falhar('novo envio com outro já aguardando parecer (RN08)',
  format('CALL sp_enviar_projeto(%s, %s, %L, %L)',
         :dono, :desafio_dono, 'https://exemplo.test/v9', 'de novo'));

\echo ''
\echo '--- Imutabilidade (RN18): trigger BEFORE UPDATE OR DELETE'
SELECT * FROM pg_temp.deve_falhar('alterar os pontos de uma pontuação',
  'UPDATE pontuacao SET pontos = 999 WHERE id_participacao = (SELECT min(id_participacao) FROM pontuacao)')
UNION ALL SELECT * FROM pg_temp.deve_falhar('apagar uma conclusão',
  'DELETE FROM conclusao WHERE id_participacao = (SELECT min(id_participacao) FROM conclusao)')
UNION ALL SELECT * FROM pg_temp.deve_falhar('trocar a decisão de um resultado',
  $q$UPDATE resultado_tentativa SET decisao = 'aprovada' WHERE id_tentativa = (SELECT min(id_tentativa) FROM resultado_tentativa WHERE decisao = 'reprovada')$q$);

\echo ''
\echo '--- Atomicidade (RNF02): falha provocada DEPOIS da procedure, antes do COMMIT'
SAVEPOINT antes_da_falha;
CALL sp_aprovar_projeto(:t, :gestor, 'aprovado, mas a transação vai falhar');
SELECT 'dentro da transação, antes da falha' AS momento,
       (SELECT count(*) FROM resultado_tentativa WHERE id_tentativa = :t) AS resultado,
       (SELECT count(*) FROM conclusao WHERE id_participacao = :p) AS conclusao,
       (SELECT count(*) FROM pontuacao WHERE id_participacao = :p) AS pontuacao;
ROLLBACK TO SAVEPOINT antes_da_falha;   -- o mesmo que acontece quando a API recebe um erro
SELECT 'depois do ROLLBACK' AS momento,
       (SELECT count(*) FROM resultado_tentativa WHERE id_tentativa = :t) AS resultado,
       (SELECT count(*) FROM conclusao WHERE id_participacao = :p) AS conclusao,
       (SELECT count(*) FROM pontuacao WHERE id_participacao = :p) AS pontuacao;

\echo ''
\echo '--- Idempotência (RN09): o gestor aprova duas vezes (clique duplo)'
CALL sp_aprovar_projeto(:t, :gestor, 'Ótimo trabalho');
CALL sp_aprovar_projeto(:t, :gestor, 'Ótimo trabalho');
SELECT (SELECT count(*) FROM conclusao WHERE id_participacao = :p) AS conclusoes,
       (SELECT count(*) FROM pontuacao WHERE id_participacao = :p) AS pontuacoes,
       (SELECT pontos FROM pontuacao WHERE id_participacao = :p) AS pontos;

\echo ''
\echo '--- Depois de aprovado, o desafio não recebe novo envio (RN07)'
SELECT * FROM pg_temp.deve_falhar('novo envio após aprovação',
  format('CALL sp_enviar_projeto(%s, %s, %L, %L)',
         :dono, :desafio_dono, 'https://exemplo.test/v10', 'mais um'))
UNION ALL SELECT * FROM pg_temp.deve_falhar('pedir ajustes após aprovação',
  format('CALL sp_pedir_ajustes(%s, %s, %L)', :t, :gestor, 'mude a cor'));

\echo ''
\echo '--- RN06: desafio antes de concluir os quizzes'
SELECT m.id_usuario AS sem_quiz, a.id_avaliacao AS desafio
FROM matricula m
JOIN modulo mo ON mo.id_trilha = m.id_trilha AND mo.ordem = 3
JOIN avaliacao a ON a.id_modulo = mo.id_modulo AND a.tipo = 'projeto'
JOIN usuario u ON u.id_usuario = m.id_usuario AND u.ativo
WHERE (SELECT count(*) FROM participacao_avaliacao pa JOIN conclusao c USING (id_participacao)
       WHERE pa.id_matricula = m.id_matricula) < 3
ORDER BY m.id_matricula LIMIT 1 \gset
SELECT * FROM pg_temp.deve_falhar('membro sem os 3 quizzes envia o desafio',
  format('CALL sp_enviar_projeto(%s, %s, %L, %L)', :sem_quiz, :desafio, 'https://exemplo.test/cedo', 'cedo demais'));

ROLLBACK;
