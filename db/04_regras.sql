-- =====================================================================================
-- 04_regras.sql  |  Regras críticas dentro do banco: trigger de pontos e procedures
-- Escrito pelo agente em 12/11/2026 a partir do roteiro do Fideles (DEC-008, DEC-009).
-- =====================================================================================
--
-- Códigos de erro próprios (SQLSTATE de 5 caracteres). A API traduz para HTTP:
--   EJ400 → 400 dado inválido     EJ403 → 403 sem permissão
--   EJ404 → 404 não encontrado    EJ409 → 409 conflito com o estado atual
--
-- Nenhuma procedure faz COMMIT. Quem abre e fecha a transação é quem chama (a API ou você no
-- psql). Assim, se qualquer passo falhar, o ROLLBACK desfaz tudo junto (atomicidade, RNF02).
--
-- Nomes seguem a convenção da aula 5 de BD2 (DEC-011): vw_ para views, sp_ para procedures,
-- trg_ para triggers e fn_ para funções.

-- ================================================================== IMUTABILIDADE (RN18)
-- Resultado, conclusão e pontuação são fatos históricos: não se editam nem se apagam no MVP.
-- BEFORE UPDATE OR DELETE: roda ANTES da alteração e a cancela levantando exceção.
-- OLD é a linha como estava (em UPDATE e DELETE existe OLD; em INSERT só existe NEW).
-- Uma constraint não consegue proibir UPDATE/DELETE; por isso aqui a trigger é a ferramenta certa
-- (regra da aula 5: "se der para resolver com constraint, prefira constraint").
CREATE FUNCTION fn_bloquear_alteracao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% é histórico e não pode ser alterado nem apagado (RN18)', TG_TABLE_NAME
        USING ERRCODE = 'EJ409';
    RETURN OLD;   -- nunca chega aqui; trigger BEFORE precisa devolver a linha ou NULL
END;
$$;

CREATE TRIGGER trg_resultado_imutavel BEFORE UPDATE OR DELETE ON resultado_tentativa
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_alteracao();
CREATE TRIGGER trg_conclusao_imutavel BEFORE UPDATE OR DELETE ON conclusao
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_alteracao();
CREATE TRIGGER trg_pontuacao_imutavel BEFORE UPDATE OR DELETE ON pontuacao
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_alteracao();

-- ================================================================== TRIGGER DE PONTOS (RN09, RN10, RN13)
-- Toda conclusão gera exatamente uma pontuação, na MESMA transação.
-- AFTER INSERT: roda depois que a linha de conclusão já entrou (e passou nas restrições).
-- FOR EACH ROW: roda uma vez por linha inserida; NEW é a linha nova.
-- Se a trigger falhar, a conclusão também é desfeita: as duas entram juntas ou nenhuma entra.
CREATE FUNCTION fn_conceder_pontos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO pontuacao (id_participacao, pontos, concedida_em)
    SELECT NEW.id_participacao, a.pontos_previstos, NEW.concluida_em   -- RN13: momento da aprovação
    FROM participacao_avaliacao pa
    JOIN avaliacao a ON a.id_avaliacao = pa.id_avaliacao
    WHERE pa.id_participacao = NEW.id_participacao;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conclusao_pontua
    AFTER INSERT ON conclusao
    FOR EACH ROW EXECUTE FUNCTION fn_conceder_pontos();

-- ================================================================== ESCOPO DO GESTOR (RN02)
-- Pode avaliar quem é gestor geral ou gestor ativo da diretoria dona da trilha.
CREATE FUNCTION fn_pode_avaliar(p_usuario bigint, p_diretoria bigint) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM usuario u
        WHERE u.id_usuario = p_usuario AND u.ativo
          AND (u.gestor_geral OR EXISTS (
                SELECT 1 FROM vinculo_diretoria v
                WHERE v.id_usuario = u.id_usuario AND v.id_diretoria = p_diretoria
                  AND v.papel = 'gestor' AND v.ativo))
    );
$$;

-- ================================================================== CONTEXTO DE UMA TENTATIVA
-- Trava a participação da tentativa (FOR UPDATE) e devolve o que as procedures precisam.
-- O FOR UPDATE segura a linha até o fim da transação: uma segunda aprovação simultânea da
-- mesma participação fica ESPERANDO aqui, e quando passa já enxerga a conclusão da primeira.
CREATE FUNCTION fn_travar_tentativa(
    p_tentativa bigint,
    OUT id_participacao bigint, OUT tipo text, OUT id_diretoria bigint,
    OUT id_dono bigint, OUT ja_concluida boolean, OUT ja_avaliada boolean)
LANGUAGE plpgsql AS $$
BEGIN
    SELECT t.id_participacao INTO id_participacao
    FROM tentativa_avaliacao t WHERE t.id_tentativa = p_tentativa;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'tentativa % não existe', p_tentativa USING ERRCODE = 'EJ404';
    END IF;

    PERFORM 1 FROM participacao_avaliacao pa
    WHERE pa.id_participacao = fn_travar_tentativa.id_participacao
    FOR UPDATE;                                                   -- o bloqueio (DEC-008)

    SELECT a.tipo, tr.id_diretoria, m.id_usuario
      INTO tipo, id_diretoria, id_dono
    FROM participacao_avaliacao pa
    JOIN avaliacao a  ON a.id_avaliacao = pa.id_avaliacao
    JOIN modulo mo    ON mo.id_modulo   = a.id_modulo
    JOIN trilha tr    ON tr.id_trilha   = mo.id_trilha
    JOIN matricula m  ON m.id_matricula = pa.id_matricula
    WHERE pa.id_participacao = fn_travar_tentativa.id_participacao;

    ja_concluida := EXISTS (SELECT 1 FROM conclusao c
                            WHERE c.id_participacao = fn_travar_tentativa.id_participacao);
    ja_avaliada  := EXISTS (SELECT 1 FROM resultado_tentativa r WHERE r.id_tentativa = p_tentativa);
END;
$$;

-- Validações comuns de quem dá parecer em desafio.
CREATE FUNCTION fn_validar_avaliador(p_avaliador bigint, p_tipo text, p_diretoria bigint, p_dono bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF p_tipo <> 'projeto' THEN
        RAISE EXCEPTION 'só desafios (projeto) recebem parecer; quiz é corrigido pelo servidor'
            USING ERRCODE = 'EJ409';
    END IF;
    IF p_avaliador = p_dono THEN
        RAISE EXCEPTION 'autoaprovação não é permitida' USING ERRCODE = 'EJ403';
    END IF;
    IF NOT fn_pode_avaliar(p_avaliador, p_diretoria) THEN
        RAISE EXCEPTION 'usuário % não é gestor desta diretoria', p_avaliador USING ERRCODE = 'EJ403';
    END IF;
END;
$$;

-- ================================================================== APROVAR DESAFIO (RF08, RN09, RNF02, RNF03)
-- Procedure (CALL) e não function (SELECT): ela executa uma ação que muda dados e devolve
-- só um status. O INOUT p_status é como a procedure "responde" a quem chamou.
CREATE PROCEDURE sp_aprovar_projeto(
    p_tentativa bigint, p_avaliador bigint, p_parecer text, INOUT p_status text DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    ctx record;
BEGIN
    SELECT * INTO ctx FROM fn_travar_tentativa(p_tentativa);   -- 1. trava a participação

    -- 2. Quem pode avaliar? Vem ANTES da idempotência: um usuário sem permissão recebe 403
    --    mesmo que a entrega já esteja aprovada (não vaza estado para quem não deve ver).
    PERFORM fn_validar_avaliador(p_avaliador, ctx.tipo, ctx.id_diretoria, ctx.id_dono);

    IF ctx.ja_concluida THEN                                     -- 3. idempotência:
        p_status := 'ja_aprovada';                               --    repetir não gera ponto novo
        RETURN;
    END IF;

    IF ctx.ja_avaliada THEN
        RAISE EXCEPTION 'tentativa % já recebeu parecer', p_tentativa USING ERRCODE = 'EJ409';
    END IF;

    INSERT INTO resultado_tentativa (id_tentativa, id_avaliador, decisao, parecer)   -- 4.
    VALUES (p_tentativa, p_avaliador, 'aprovada', NULLIF(btrim(p_parecer), ''));

    INSERT INTO conclusao (id_participacao, id_tentativa)       -- 5. a trigger grava os pontos
    VALUES (ctx.id_participacao, p_tentativa);

    p_status := 'aprovada';                                      -- 6.
END;
$$;

-- ================================================================== PEDIR AJUSTES (RF08, RN07)
CREATE PROCEDURE sp_pedir_ajustes(
    p_tentativa bigint, p_avaliador bigint, p_parecer text, INOUT p_status text DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    ctx record;
BEGIN
    SELECT * INTO ctx FROM fn_travar_tentativa(p_tentativa);

    PERFORM fn_validar_avaliador(p_avaliador, ctx.tipo, ctx.id_diretoria, ctx.id_dono);

    IF ctx.ja_concluida THEN
        RAISE EXCEPTION 'participação já concluída; não cabe pedir ajustes' USING ERRCODE = 'EJ409';
    END IF;
    IF ctx.ja_avaliada THEN
        RAISE EXCEPTION 'tentativa % já recebeu parecer', p_tentativa USING ERRCODE = 'EJ409';
    END IF;
    IF p_parecer IS NULL OR length(btrim(p_parecer)) = 0 THEN
        RAISE EXCEPTION 'pedido de ajustes exige parecer' USING ERRCODE = 'EJ400';
    END IF;

    INSERT INTO resultado_tentativa (id_tentativa, id_avaliador, decisao, parecer)
    VALUES (p_tentativa, p_avaliador, 'ajustes', btrim(p_parecer));

    p_status := 'ajustes';
END;
$$;

-- ================================================================== ENVIAR DESAFIO (RF07, RN06, RN07, RN08)
-- O membro envia link e descrição. Cria a participação na primeira vez e numera as tentativas.
CREATE PROCEDURE sp_enviar_projeto(
    p_usuario bigint, p_avaliacao bigint, p_link text, p_descricao text,
    INOUT p_id_tentativa bigint DEFAULT NULL, INOUT p_numero int DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_tipo         text;
    v_trilha       bigint;
    v_matricula    bigint;
    v_participacao bigint;
    v_quizzes_pendentes int;
BEGIN
    SELECT a.tipo, mo.id_trilha INTO v_tipo, v_trilha
    FROM avaliacao a JOIN modulo mo ON mo.id_modulo = a.id_modulo
    WHERE a.id_avaliacao = p_avaliacao;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'avaliação % não existe', p_avaliacao USING ERRCODE = 'EJ404';
    END IF;
    IF v_tipo <> 'projeto' THEN
        RAISE EXCEPTION 'esta avaliação é um quiz; envio por link vale só para desafio' USING ERRCODE = 'EJ409';
    END IF;
    IF p_link IS NULL OR p_link !~ '^https?://' THEN
        RAISE EXCEPTION 'link do projeto deve começar com http:// ou https://' USING ERRCODE = 'EJ400';
    END IF;

    SELECT m.id_matricula INTO v_matricula
    FROM matricula m JOIN usuario u ON u.id_usuario = m.id_usuario
    WHERE m.id_usuario = p_usuario AND m.id_trilha = v_trilha AND u.ativo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'usuário % não está matriculado nesta trilha', p_usuario USING ERRCODE = 'EJ403';
    END IF;

    -- RN06: desafio só depois de aprovado em todos os quizzes obrigatórios da trilha.
    SELECT count(*) INTO v_quizzes_pendentes
    FROM avaliacao a JOIN modulo mo ON mo.id_modulo = a.id_modulo
    WHERE mo.id_trilha = v_trilha AND a.tipo = 'quiz' AND a.obrigatoria
      AND NOT EXISTS (SELECT 1 FROM participacao_avaliacao pa
                      JOIN conclusao c ON c.id_participacao = pa.id_participacao
                      WHERE pa.id_matricula = v_matricula AND pa.id_avaliacao = a.id_avaliacao);
    IF v_quizzes_pendentes > 0 THEN
        RAISE EXCEPTION 'faltam % quiz(zes) da trilha antes do desafio', v_quizzes_pendentes
            USING ERRCODE = 'EJ409';
    END IF;

    -- Cria a participação na primeira vez. ON CONFLICT: se outra transação criou ao mesmo
    -- tempo, não dá erro; o SELECT ... FOR UPDATE abaixo pega a linha que ficou.
    INSERT INTO participacao_avaliacao (id_matricula, id_avaliacao)
    VALUES (v_matricula, p_avaliacao)
    ON CONFLICT (id_matricula, id_avaliacao) DO NOTHING;

    SELECT pa.id_participacao INTO v_participacao
    FROM participacao_avaliacao pa
    WHERE pa.id_matricula = v_matricula AND pa.id_avaliacao = p_avaliacao
    FOR UPDATE;                    -- dois envios ao mesmo tempo viram fila, não duplicata (RN08)

    IF EXISTS (SELECT 1 FROM conclusao c WHERE c.id_participacao = v_participacao) THEN
        RAISE EXCEPTION 'desafio já aprovado; não recebe novo envio' USING ERRCODE = 'EJ409';  -- RN07
    END IF;
    IF EXISTS (SELECT 1 FROM tentativa_avaliacao t
               WHERE t.id_participacao = v_participacao
                 AND NOT EXISTS (SELECT 1 FROM resultado_tentativa r WHERE r.id_tentativa = t.id_tentativa)) THEN
        RAISE EXCEPTION 'já existe um envio aguardando parecer' USING ERRCODE = 'EJ409';       -- RN08
    END IF;

    SELECT COALESCE(max(t.numero), 0) + 1 INTO p_numero
    FROM tentativa_avaliacao t WHERE t.id_participacao = v_participacao;

    INSERT INTO tentativa_avaliacao (id_participacao, numero, link_projeto, descricao_entrega)
    VALUES (v_participacao, p_numero, p_link, NULLIF(btrim(p_descricao), ''))
    RETURNING id_tentativa INTO p_id_tentativa;
END;
$$;

-- ================================================================== RESPONDER QUIZ (RF06, RN05, RN07, RN09)
-- O membro manda as respostas; o BANCO corrige (o gabarito nunca sai do servidor).
-- p_respostas: JSON com uma resposta por questão, por exemplo
--   [{"id_questao": 1, "alternativa": 3}, {"id_questao": 2, "alternativa": 1}, ...]
-- Tudo numa transação: tentativa, respostas, resultado e, se aprovado, conclusão (+ pontos pela
-- trigger). Mesma convenção de bloqueio do desafio: FOR UPDATE na participação.
CREATE PROCEDURE sp_responder_quiz(
    p_usuario bigint, p_avaliacao bigint, p_respostas jsonb,
    INOUT p_id_tentativa bigint DEFAULT NULL, INOUT p_percentual numeric DEFAULT NULL,
    INOUT p_decisao text DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_tipo         text;
    v_minimo       numeric;
    v_trilha       bigint;
    v_matricula    bigint;
    v_participacao bigint;
    v_numero       int;
    v_questoes     int;
    v_validas      int;
BEGIN
    SELECT a.tipo, a.percentual_minimo, mo.id_trilha INTO v_tipo, v_minimo, v_trilha
    FROM avaliacao a JOIN modulo mo ON mo.id_modulo = a.id_modulo
    WHERE a.id_avaliacao = p_avaliacao;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'avaliação % não existe', p_avaliacao USING ERRCODE = 'EJ404';
    END IF;
    IF v_tipo <> 'quiz' THEN
        RAISE EXCEPTION 'esta avaliação é um desafio; envie o link do projeto' USING ERRCODE = 'EJ409';
    END IF;

    SELECT m.id_matricula INTO v_matricula
    FROM matricula m JOIN usuario u ON u.id_usuario = m.id_usuario
    WHERE m.id_usuario = p_usuario AND m.id_trilha = v_trilha AND u.ativo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'usuário % não está matriculado nesta trilha', p_usuario USING ERRCODE = 'EJ403';
    END IF;

    -- RN05: uma resposta para CADA questão do quiz, nenhuma de fora, alternativa existente.
    SELECT count(*) INTO v_questoes FROM questao WHERE id_avaliacao = p_avaliacao;
    SELECT count(DISTINCT q.id_questao) INTO v_validas
    FROM jsonb_to_recordset(COALESCE(p_respostas, '[]'::jsonb)) AS r(id_questao bigint, alternativa smallint)
    JOIN questao q     ON q.id_questao = r.id_questao AND q.id_avaliacao = p_avaliacao
    JOIN alternativa a ON a.id_questao = r.id_questao AND a.numero = r.alternativa;
    IF v_validas <> v_questoes OR jsonb_array_length(COALESCE(p_respostas, '[]'::jsonb)) <> v_questoes THEN
        RAISE EXCEPTION 'responda cada uma das % questões uma única vez, com alternativas válidas', v_questoes
            USING ERRCODE = 'EJ400';
    END IF;

    INSERT INTO participacao_avaliacao (id_matricula, id_avaliacao)
    VALUES (v_matricula, p_avaliacao)
    ON CONFLICT (id_matricula, id_avaliacao) DO NOTHING;

    SELECT pa.id_participacao INTO v_participacao
    FROM participacao_avaliacao pa
    WHERE pa.id_matricula = v_matricula AND pa.id_avaliacao = p_avaliacao
    FOR UPDATE;

    IF EXISTS (SELECT 1 FROM conclusao c WHERE c.id_participacao = v_participacao) THEN
        RAISE EXCEPTION 'quiz já aprovado; não recebe nova tentativa' USING ERRCODE = 'EJ409';  -- RN07
    END IF;

    SELECT COALESCE(max(numero), 0) + 1 INTO v_numero
    FROM tentativa_avaliacao WHERE id_participacao = v_participacao;

    INSERT INTO tentativa_avaliacao (id_participacao, numero)
    VALUES (v_participacao, v_numero)
    RETURNING id_tentativa INTO p_id_tentativa;

    INSERT INTO resposta_tentativa (id_tentativa, id_questao, numero_alternativa)
    SELECT p_id_tentativa, r.id_questao, r.alternativa
    FROM jsonb_to_recordset(p_respostas) AS r(id_questao bigint, alternativa smallint);

    -- Correção no servidor: percentual a partir das respostas GRAVADAS (RN05).
    SELECT round(100.0 * sum((a.correta)::int) / count(*), 2) INTO p_percentual
    FROM resposta_tentativa r
    JOIN alternativa a ON a.id_questao = r.id_questao AND a.numero = r.numero_alternativa
    WHERE r.id_tentativa = p_id_tentativa;

    p_decisao := CASE WHEN p_percentual >= v_minimo THEN 'aprovada' ELSE 'reprovada' END;

    INSERT INTO resultado_tentativa (id_tentativa, decisao, percentual_acerto)
    VALUES (p_id_tentativa, p_decisao, p_percentual);

    IF p_decisao = 'aprovada' THEN
        INSERT INTO conclusao (id_participacao, id_tentativa)   -- a trigger grava os pontos
        VALUES (v_participacao, p_id_tentativa);
    END IF;
END;
$$;

-- ================================================================== LOGIN (RF01, RNF04, RN17)
-- Confere e-mail e senha e devolve o id do usuário, ou NULL. A comparação acontece no banco:
-- crypt(senha_digitada, hash_guardado) refaz o bcrypt com o MESMO sal e compara.
-- lower(email) usa o índice único usuario_email_uk. Desligado (ativo = false) não entra.
CREATE FUNCTION fn_autenticar(p_email text, p_senha text) RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT u.id_usuario FROM usuario u
    WHERE lower(u.email) = lower(btrim(p_email))
      AND u.ativo
      AND u.senha_hash = crypt(p_senha, u.senha_hash);
$$;
