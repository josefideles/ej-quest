-- =====================================================================================
-- testes/01_restricoes.sql  |  Gate G-dados: o banco recusa o que é proibido?
-- Cada caso tenta uma operação proibida. O esperado é o banco RECUSAR.
-- Tudo roda dentro de BEGIN ... ROLLBACK: nada fica gravado.
-- É o exercício 1.8 do manual, rodando de verdade.
-- =====================================================================================
\set QUIET on
\pset footer off
BEGIN;

-- deve_falhar: executa o SQL; se o banco aceitar, o teste FALHOU. Se recusar, mostra o motivo.
CREATE FUNCTION pg_temp.deve_falhar(p_caso text, p_sql text) RETURNS TABLE (caso text, resultado text)
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE p_sql;
    RETURN QUERY SELECT p_caso, 'FALHOU: o banco aceitou'::text;
EXCEPTION WHEN others THEN
    RETURN QUERY SELECT p_caso, 'OK, recusado: ' || SQLERRM;
END;
$$;

SELECT * FROM pg_temp.deve_falhar('1. matrícula duplicada (RN04, UNIQUE)',
  $q$INSERT INTO matricula (id_usuario, id_trilha) SELECT id_usuario, id_trilha FROM matricula LIMIT 1$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('2. tentativa de participação inexistente (RNF01, FK)',
  $q$INSERT INTO tentativa_avaliacao (id_participacao, numero) VALUES (99999999, 1)$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('3. avaliação do tipo ''prova'' (CHECK)',
  $q$INSERT INTO avaliacao (id_modulo, tipo, titulo, pontos_previstos, percentual_minimo) VALUES (1, 'prova', 'x', 10, 70)$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('4. segunda pontuação na mesma participação (RN09, PK)',
  $q$INSERT INTO pontuacao (id_participacao, pontos, concedida_em) SELECT id_participacao, 999, now() FROM pontuacao LIMIT 1$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('5. apagar usuário com histórico (RN17, ON DELETE RESTRICT)',
  $q$DELETE FROM usuario WHERE id_usuario = 5$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('6. e-mail repetido com outra caixa (RN01, índice em lower)',
  $q$INSERT INTO usuario (nome, email, senha_hash) VALUES ('Cópia', 'USUARIO5@EJQUEST.TEST', 'x')$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('7. duas alternativas corretas na mesma questão (RN05, índice parcial)',
  $q$UPDATE alternativa SET correta = true WHERE id_questao = 1$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('8. conclusão com tentativa de OUTRA participação (FK composta)',
  $q$INSERT INTO conclusao (id_participacao, id_tentativa)
     SELECT pa.id_participacao, (SELECT r.id_tentativa FROM resultado_tentativa r
                                  JOIN tentativa_avaliacao t ON t.id_tentativa = r.id_tentativa
                                  WHERE t.id_participacao <> pa.id_participacao LIMIT 1)
     FROM participacao_avaliacao pa
     WHERE NOT EXISTS (SELECT 1 FROM conclusao c WHERE c.id_participacao = pa.id_participacao) LIMIT 1$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('9. resposta com alternativa que não existe na questão (FK composta)',
  $q$INSERT INTO resposta_tentativa (id_tentativa, id_questao, numero_alternativa)
     SELECT id_tentativa, 1, 9 FROM vw_fila_avaliacao LIMIT 1$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('10. quiz sem nota mínima (CHECK condicional)',
  $q$INSERT INTO avaliacao (id_modulo, tipo, titulo, pontos_previstos) VALUES (1, 'quiz', 'x', 10)$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('11. pontos zerados (RN10, CHECK)',
  $q$INSERT INTO avaliacao (id_modulo, tipo, titulo, pontos_previstos) VALUES (1, 'projeto', 'x', 0)$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('12. pedido de ajustes sem parecer (CHECK)',
  $q$INSERT INTO resultado_tentativa (id_tentativa, id_avaliador, decisao, parecer)
     SELECT id_tentativa, 2, 'ajustes', '  ' FROM vw_fila_avaliacao LIMIT 1$q$)
UNION ALL SELECT * FROM pg_temp.deve_falhar('13. pedido de ajustes com parecer NULL (CHECK com NULL)',
  $q$INSERT INTO resultado_tentativa (id_tentativa, id_avaliador, decisao, parecer)
     SELECT id_tentativa, 2, 'ajustes', NULL FROM vw_fila_avaliacao LIMIT 1$q$);

ROLLBACK;
