-- =====================================================================================
-- 01_schema.sql  |  Tabelas e restrições do EJ Quest (16 tabelas, 3FN)
-- Escrito pelo agente em 12/11/2026 a partir do roteiro do Fideles (DEC-009).
-- Fonte: ER da seção 5.3 do planejamento da AB1 e manual, cap. 1 e 2.
-- =====================================================================================
--
-- Como ler cada tabela (pergunta → restrição):
--   qual a chave?            → PRIMARY KEY
--   quem eu referencio?      → FOREIGN KEY ... ON DELETE RESTRICT (RN17: histórico não se apaga)
--   o que não pode repetir?  → UNIQUE
--   que valor é proibido?    → CHECK / NOT NULL
--
-- Convenção: chave substituta "id_<tabela> bigint GENERATED ALWAYS AS IDENTITY".
-- O banco gera o número; ninguém consegue inserir um id "na mão" por engano.

-- ================================================================== ACESSO

CREATE TABLE usuario (
    id_usuario    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome          text        NOT NULL CHECK (length(btrim(nome)) > 0),
    email         text        NOT NULL CHECK (email LIKE '%_@_%'),
    senha_hash    text        NOT NULL,                     -- nunca a senha pura (RNF04)
    ativo         boolean     NOT NULL DEFAULT true,        -- RN17: desligar = false, nunca DELETE
    gestor_geral  boolean     NOT NULL DEFAULT false,
    criado_em     timestamptz NOT NULL DEFAULT now()
);

-- RN01: e-mail único sem diferenciar maiúsculas. Um UNIQUE (email) comum deixaria
-- 'A@x.com' e 'a@x.com' conviverem; o índice único sobre lower(email) não deixa.
CREATE UNIQUE INDEX usuario_email_uk ON usuario (lower(email));

CREATE TABLE diretoria (
    id_diretoria  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome          text NOT NULL UNIQUE CHECK (length(btrim(nome)) > 0)
);

-- Tabela associativa (N:N entre usuário e diretoria). A chave é o par.
-- "papel" depende do PAR (você pode ser gestor em Projetos e membro em Marketing): 2FN.
CREATE TABLE vinculo_diretoria (
    id_usuario    bigint  NOT NULL REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    id_diretoria  bigint  NOT NULL REFERENCES diretoria (id_diretoria) ON DELETE RESTRICT,
    papel         text    NOT NULL CHECK (papel IN ('membro', 'gestor')),
    ativo         boolean NOT NULL DEFAULT true,
    PRIMARY KEY (id_usuario, id_diretoria)
);

-- ================================================================== CONTEÚDO

CREATE TABLE trilha (
    id_trilha     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_diretoria  bigint NOT NULL REFERENCES diretoria (id_diretoria) ON DELETE RESTRICT,
    titulo        text   NOT NULL CHECK (length(btrim(titulo)) > 0),
    descricao     text,
    status        text   NOT NULL DEFAULT 'rascunho'
                         CHECK (status IN ('rascunho', 'publicada', 'arquivada')),
    criada_em     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE modulo (
    id_modulo  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_trilha  bigint NOT NULL REFERENCES trilha (id_trilha) ON DELETE RESTRICT,
    titulo     text   NOT NULL,
    ordem      int    NOT NULL CHECK (ordem > 0),
    CONSTRAINT modulo_ordem_uk UNIQUE (id_trilha, ordem)      -- dois módulos não ocupam a mesma posição
);

CREATE TABLE licao (
    id_licao     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_modulo    bigint NOT NULL REFERENCES modulo (id_modulo) ON DELETE RESTRICT,
    titulo       text   NOT NULL,
    texto        text,
    url_externa  text   CHECK (url_externa ~ '^https?://'),
    ordem        int    NOT NULL CHECK (ordem > 0),
    CONSTRAINT licao_ordem_uk UNIQUE (id_modulo, ordem),
    CONSTRAINT licao_tem_conteudo_ck CHECK (texto IS NOT NULL OR url_externa IS NOT NULL)
);

CREATE TABLE avaliacao (
    id_avaliacao       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_modulo          bigint  NOT NULL REFERENCES modulo (id_modulo) ON DELETE RESTRICT,
    tipo               text    NOT NULL CONSTRAINT avaliacao_tipo_ck CHECK (tipo IN ('quiz', 'projeto')),
    titulo             text    NOT NULL,
    instrucoes         text,
    pontos_previstos   int     NOT NULL CHECK (pontos_previstos > 0),       -- RN10
    percentual_minimo  numeric(5,2),
    obrigatoria        boolean NOT NULL DEFAULT true,                       -- entra no progresso (RN11)
    -- Quiz exige nota mínima entre 0 e 100; projeto (desafio) não tem nota, tem parecer.
    -- CUIDADO, armadilha clássica: CHECK só recusa quando a expressão dá FALSE. Se der NULL,
    -- ACEITA. Sem o "IS NOT NULL", um quiz com percentual_minimo NULL passaria, porque
    -- NULL BETWEEN 0 AND 100 é NULL, e NULL OR FALSE é NULL. O teste 10 pegou isso.
    CONSTRAINT avaliacao_tipo_minimo_ck CHECK (
        (tipo = 'quiz'    AND percentual_minimo IS NOT NULL AND percentual_minimo BETWEEN 0 AND 100) OR
        (tipo = 'projeto' AND percentual_minimo IS NULL)
    )
);

CREATE TABLE questao (
    id_questao    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_avaliacao  bigint NOT NULL REFERENCES avaliacao (id_avaliacao) ON DELETE RESTRICT,
    enunciado     text   NOT NULL,
    ordem         int    NOT NULL CHECK (ordem > 0),
    CONSTRAINT questao_ordem_uk UNIQUE (id_avaliacao, ordem)
);

-- Entidade fraca: a alternativa só existe dentro da questão ("alternativa 2 da questão 57").
-- Por isso a chave é composta (id_questao, numero), sem id próprio.
CREATE TABLE alternativa (
    id_questao  bigint   NOT NULL REFERENCES questao (id_questao) ON DELETE RESTRICT,
    numero      smallint NOT NULL CHECK (numero BETWEEN 1 AND 10),
    texto       text     NOT NULL,
    correta     boolean  NOT NULL DEFAULT false,
    PRIMARY KEY (id_questao, numero)
);

-- Índice único PARCIAL: só as linhas com correta = true entram no índice.
-- Resultado: no máximo UMA alternativa correta por questão (RN05: resposta única).
CREATE UNIQUE INDEX alternativa_uma_correta_uk ON alternativa (id_questao) WHERE correta;

-- ================================================================== PARTICIPAÇÃO

CREATE TABLE matricula (
    id_matricula    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario      bigint NOT NULL REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    id_trilha       bigint NOT NULL REFERENCES trilha (id_trilha) ON DELETE RESTRICT,
    matriculada_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT matricula_uk UNIQUE (id_usuario, id_trilha)          -- RN04
);

-- A peça-chave do modelo (manual 1.5): agrupa as tentativas de um membro numa avaliação,
-- é a linha travada na aprovação (FOR UPDATE) e é a chave de conclusao e pontuacao.
CREATE TABLE participacao_avaliacao (
    id_participacao  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_matricula     bigint NOT NULL REFERENCES matricula (id_matricula) ON DELETE RESTRICT,
    id_avaliacao     bigint NOT NULL REFERENCES avaliacao (id_avaliacao) ON DELETE RESTRICT,
    iniciada_em      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT participacao_uk UNIQUE (id_matricula, id_avaliacao)  -- RN04
);

-- 3FN: tentativa NÃO tem id_usuario. O usuário é alcançado por
-- tentativa → participação → matrícula → usuário. Guardar de novo permitiria contradição.
CREATE TABLE tentativa_avaliacao (
    id_tentativa       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_participacao    bigint NOT NULL REFERENCES participacao_avaliacao (id_participacao) ON DELETE RESTRICT,
    numero             int    NOT NULL CHECK (numero > 0),
    enviada_em         timestamptz NOT NULL DEFAULT now(),
    link_projeto       text   CHECK (link_projeto ~ '^https?://'),
    descricao_entrega  text,
    CONSTRAINT tentativa_numero_uk UNIQUE (id_participacao, numero),
    -- Existe só para servir de alvo à FK composta de "conclusao" (ver lá embaixo).
    CONSTRAINT tentativa_participacao_uk UNIQUE (id_participacao, id_tentativa)
);

-- Uma linha por questão respondida. 1FN: nada de '2,4,1,3' numa coluna só.
-- A FK composta garante que a alternativa escolhida é DAQUELA questão.
CREATE TABLE resposta_tentativa (
    id_tentativa        bigint   NOT NULL REFERENCES tentativa_avaliacao (id_tentativa) ON DELETE RESTRICT,
    id_questao          bigint   NOT NULL,
    numero_alternativa  smallint NOT NULL,
    PRIMARY KEY (id_tentativa, id_questao),                           -- uma resposta por questão
    CONSTRAINT resposta_alternativa_fk FOREIGN KEY (id_questao, numero_alternativa)
        REFERENCES alternativa (id_questao, numero) ON DELETE RESTRICT
);

-- 1:1 com a tentativa (a PK é a própria FK). Quiz: corrigido pelo servidor, sem avaliador.
-- Projeto: tem avaliador e parecer.
CREATE TABLE resultado_tentativa (
    id_tentativa       bigint PRIMARY KEY REFERENCES tentativa_avaliacao (id_tentativa) ON DELETE RESTRICT,
    id_avaliador       bigint REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
    decisao            text   NOT NULL CHECK (decisao IN ('aprovada', 'reprovada', 'ajustes')),
    percentual_acerto  numeric(5,2) CHECK (percentual_acerto BETWEEN 0 AND 100),  -- fato histórico
    parecer            text,
    avaliada_em        timestamptz NOT NULL DEFAULT now(),
    -- Ou foi corrigido automaticamente (tem nota) ou alguém avaliou (tem avaliador).
    CONSTRAINT resultado_origem_ck CHECK (id_avaliador IS NOT NULL OR percentual_acerto IS NOT NULL),
    -- Pedido de ajustes sem explicação não ajuda o membro (RNF08).
    -- Mesma armadilha do NULL: sem "parecer IS NOT NULL", um parecer NULL passaria.
    CONSTRAINT resultado_ajustes_parecer_ck CHECK (
        decisao <> 'ajustes' OR (parecer IS NOT NULL AND length(btrim(parecer)) > 0))
);

-- ================================================================== RECOMPENSA

-- PK = id_participacao: é IMPOSSÍVEL existir duas conclusões para a mesma participação,
-- mesmo com bug na API (RN09, barreira 2 contra aprovação dupla).
CREATE TABLE conclusao (
    id_participacao  bigint PRIMARY KEY
                     REFERENCES participacao_avaliacao (id_participacao) ON DELETE RESTRICT,
    id_tentativa     bigint NOT NULL UNIQUE
                     REFERENCES resultado_tentativa (id_tentativa) ON DELETE RESTRICT,
    concluida_em     timestamptz NOT NULL DEFAULT now(),
    -- FK composta: a tentativa que fundamenta a conclusão PERTENCE a esta participação.
    -- Sem ela, daria para concluir a participação 300 com a tentativa de outra pessoa.
    CONSTRAINT conclusao_tentativa_da_participacao_fk FOREIGN KEY (id_participacao, id_tentativa)
        REFERENCES tentativa_avaliacao (id_participacao, id_tentativa) ON DELETE RESTRICT
);

-- 1:1 com a conclusão. "pontos" é fato histórico: o que a avaliação valia no momento
-- (se a avaliação mudar de 80 para 100, quem já ganhou continua com 80).
CREATE TABLE pontuacao (
    id_participacao  bigint PRIMARY KEY REFERENCES conclusao (id_participacao) ON DELETE RESTRICT,
    pontos           int    NOT NULL CHECK (pontos > 0),
    concedida_em     timestamptz NOT NULL                -- RN13: desempate pelo momento da recompensa
);
