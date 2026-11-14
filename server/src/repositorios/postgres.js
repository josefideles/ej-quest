// Repositório SQL: TODO o SQL da API mora aqui (camada Repository da arquitetura MVC/Layered
// recomendada na especificação de BD2, seção 3.1). Os serviços chamam estas funções e não
// escrevem SQL. Escrito pelo agente em 12/11/2026 (DEC-009, DEC-013).
//
// Sem ORM (DEC-003): cada função é uma consulta parametrizada ($1, $2...), nunca texto colado.
// As funções que recebem "client" rodam dentro de uma transação aberta pelo serviço.
const { pool } = require('../db');

// ------------------------------------------------------------------ ranking (RF11, RN12)
// RN12: total desc, última concessão asc (quem chegou primeiro), id asc (desempate final).
const ORDEM_RANKING = 'total_pontos DESC, ultima_concessao ASC, id_usuario ASC';

async function topRanking(limite) {
  const { rows } = await pool.query(
    `SELECT id_usuario, nome, total_pontos, ultima_concessao,
            count(*) OVER ()::int AS total_participantes
     FROM vw_ranking_consolidado
     ORDER BY ${ORDEM_RANKING}
     LIMIT $1`,
    [limite]
  );
  return rows;
}

// Todas as linhas do ranking, para reconstruir o placar no Redis.
async function rankingCompleto() {
  const { rows } = await pool.query(
    'SELECT id_usuario, total_pontos, ultima_concessao FROM vw_ranking_consolidado'
  );
  return rows;
}

// Total e última concessão de UM usuário (usado no Write-Through depois de uma aprovação).
async function rankingDoUsuario(idUsuario) {
  const { rows } = await pool.query(
    `SELECT id_usuario, total_pontos, ultima_concessao
     FROM vw_ranking_consolidado WHERE id_usuario = $1`,
    [idUsuario]
  );
  return rows[0] || null;
}

// Posição calculada pelo SQL (caminho sem Redis): numera TODO o ranking com row_number()
// e pega a linha do usuário. Correto, mas percorre os ~5.900 participantes a cada chamada.
async function posicaoPorSql(idUsuario) {
  const { rows } = await pool.query(
    `SELECT posicao, total_pontos, total_participantes FROM (
       SELECT id_usuario, total_pontos,
              row_number() OVER (ORDER BY ${ORDEM_RANKING})::int AS posicao,
              count(*) OVER ()::int AS total_participantes
       FROM vw_ranking_consolidado
     ) r WHERE r.id_usuario = $1`,
    [idUsuario]
  );
  return rows[0] || null;
}

async function contarParticipantes() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM vw_ranking_consolidado');
  return rows[0].n;
}

// ------------------------------------------------------------------ parecer e envio (procedures)
// "procedure" vem de uma lista fixa no serviço, nunca do usuário.
async function chamarParecer(client, procedure, { idTentativa, idAvaliador, parecer }) {
  const { rows } = await client.query(`CALL ${procedure}($1, $2, $3, NULL)`, [
    idTentativa,
    idAvaliador,
    parecer,
  ]);
  return rows[0].p_status; // o INOUT da procedure volta como coluna
}

async function chamarEnvio(client, { idUsuario, idAvaliacao, link, descricao }) {
  const { rows } = await client.query('CALL sp_enviar_projeto($1, $2, $3, $4, NULL, NULL)', [
    idUsuario,
    idAvaliacao,
    link,
    descricao,
  ]);
  return { id_tentativa: Number(rows[0].p_id_tentativa), numero: rows[0].p_numero };
}

// Dono (membro) de uma tentativa: tentativa → participação → matrícula → usuário (3FN).
async function donoDaTentativa(idTentativa) {
  const { rows } = await pool.query(
    `SELECT m.id_usuario
     FROM tentativa_avaliacao t
     JOIN participacao_avaliacao pa ON pa.id_participacao = t.id_participacao
     JOIN matricula m               ON m.id_matricula     = pa.id_matricula
     WHERE t.id_tentativa = $1`,
    [idTentativa]
  );
  return rows[0] ? Number(rows[0].id_usuario) : null;
}

// ------------------------------------------------------------------ progresso e fila (RF09, RF08)
async function progressoDaMatricula(idMatricula, idUsuario) {
  const { rows } = await pool.query(
    `SELECT p.id_matricula, p.id_usuario, p.id_trilha, tr.titulo AS trilha,
            p.avaliacoes_exigidas, p.avaliacoes_concluidas, p.percentual,
            (p.id_usuario = $2 OR fn_pode_avaliar($2, tr.id_diretoria)) AS pode_ver
     FROM vw_progresso_membro p
     JOIN trilha tr ON tr.id_trilha = p.id_trilha
     WHERE p.id_matricula = $1`,
    [idMatricula, idUsuario]
  );
  return rows[0] || null;
}

// Primeira avaliação obrigatória ainda não concluída, na ordem dos módulos
// (quiz antes do desafio dentro do mesmo módulo).
async function proximaAvaliacao(idTrilha, idMatricula) {
  const { rows } = await pool.query(
    `SELECT a.id_avaliacao, a.tipo, a.titulo, mo.ordem AS modulo
     FROM avaliacao a
     JOIN modulo mo ON mo.id_modulo = a.id_modulo
     WHERE mo.id_trilha = $1 AND a.obrigatoria
       AND NOT EXISTS (SELECT 1 FROM participacao_avaliacao pa
                       JOIN conclusao c ON c.id_participacao = pa.id_participacao
                       WHERE pa.id_matricula = $2 AND pa.id_avaliacao = a.id_avaliacao)
     ORDER BY mo.ordem, (a.tipo = 'projeto'), a.id_avaliacao
     LIMIT 1`,
    [idTrilha, idMatricula]
  );
  return rows[0] || null;
}

async function filaDoGestor(idUsuario, limite) {
  const { rows } = await pool.query(
    `SELECT f.id_tentativa, f.numero, f.enviada_em, f.link_projeto, f.descricao_entrega,
            f.trilha, f.membro, f.id_membro
     FROM vw_fila_avaliacao f
     WHERE fn_pode_avaliar($1, f.id_diretoria)
       AND f.id_membro <> $1                       -- a própria entrega não entra na fila
     ORDER BY f.enviada_em ASC
     LIMIT $2`,
    [idUsuario, limite]
  );
  return rows;
}

// ------------------------------------------------------------------ login e perfil (RF01)
async function autenticar(email, senha) {
  const { rows } = await pool.query('SELECT fn_autenticar($1, $2) AS id', [email, senha]);
  return rows[0].id ? Number(rows[0].id) : null;
}

async function usuarioAtivo(idUsuario) {
  const { rows } = await pool.query('SELECT ativo FROM usuario WHERE id_usuario = $1', [idUsuario]);
  return rows.length > 0 && rows[0].ativo;
}

// Perfil sem senha: nome, e-mail, papéis por diretoria e matrículas.
async function perfil(idUsuario) {
  const { rows } = await pool.query(
    `SELECT u.id_usuario, u.nome, u.email, u.gestor_geral,
            COALESCE((SELECT json_agg(json_build_object('diretoria', d.nome, 'papel', v.papel) ORDER BY d.nome)
                      FROM vinculo_diretoria v JOIN diretoria d ON d.id_diretoria = v.id_diretoria
                      WHERE v.id_usuario = u.id_usuario AND v.ativo), '[]') AS vinculos,
            COALESCE((SELECT json_agg(json_build_object('id_matricula', m.id_matricula, 'id_trilha', t.id_trilha,
                                                        'trilha', t.titulo) ORDER BY t.id_trilha)
                      FROM matricula m JOIN trilha t ON t.id_trilha = m.id_trilha
                      WHERE m.id_usuario = u.id_usuario), '[]') AS matriculas
     FROM usuario u WHERE u.id_usuario = $1`,
    [idUsuario]
  );
  return rows[0] || null;
}

// ------------------------------------------------------------------ estudo (RF05, RF06)
// Trilha com módulos, lições e avaliações, e o status de cada avaliação PARA este usuário.
// json_agg monta a árvore no próprio banco: uma ida ao PostgreSQL em vez de uma por módulo.
async function trilhaParaUsuario(idTrilha, idUsuario) {
  const { rows } = await pool.query(
    `SELECT t.id_trilha, t.titulo, t.descricao, t.status,
            m.id_matricula,
            (m.id_matricula IS NOT NULL OR fn_pode_avaliar($2, t.id_diretoria)) AS pode_ver,
            (SELECT json_agg(json_build_object(
                'id_modulo', mo.id_modulo, 'ordem', mo.ordem, 'titulo', mo.titulo,
                'licoes', (SELECT COALESCE(json_agg(json_build_object(
                              'id_licao', l.id_licao, 'ordem', l.ordem, 'titulo', l.titulo,
                              'texto', l.texto, 'url_externa', l.url_externa) ORDER BY l.ordem), '[]')
                           FROM licao l WHERE l.id_modulo = mo.id_modulo),
                'avaliacoes', (SELECT COALESCE(json_agg(json_build_object(
                              'id_avaliacao', a.id_avaliacao, 'tipo', a.tipo, 'titulo', a.titulo,
                              'pontos', a.pontos_previstos,
                              'concluida', EXISTS (SELECT 1 FROM participacao_avaliacao pa
                                                   JOIN conclusao c ON c.id_participacao = pa.id_participacao
                                                   WHERE pa.id_matricula = m.id_matricula
                                                     AND pa.id_avaliacao = a.id_avaliacao),
                              'tentativas', (SELECT count(*) FROM participacao_avaliacao pa
                                             JOIN tentativa_avaliacao ta ON ta.id_participacao = pa.id_participacao
                                             WHERE pa.id_matricula = m.id_matricula
                                               AND pa.id_avaliacao = a.id_avaliacao))
                              ORDER BY (a.tipo = 'projeto'), a.id_avaliacao), '[]')
                           FROM avaliacao a WHERE a.id_modulo = mo.id_modulo))
              ORDER BY mo.ordem)
             FROM modulo mo WHERE mo.id_trilha = t.id_trilha) AS modulos
     FROM trilha t
     LEFT JOIN matricula m ON m.id_trilha = t.id_trilha AND m.id_usuario = $2
     WHERE t.id_trilha = $1`,
    [idTrilha, idUsuario]
  );
  return rows[0] || null;
}

// Quiz para responder: questões e alternativas SEM a coluna "correta" (o gabarito não sai do banco).
async function quizParaResponder(idAvaliacao, idUsuario) {
  const { rows } = await pool.query(
    `SELECT a.id_avaliacao, a.tipo, a.titulo, a.instrucoes, a.percentual_minimo, a.pontos_previstos,
            (EXISTS (SELECT 1 FROM matricula m WHERE m.id_trilha = mo.id_trilha AND m.id_usuario = $2)
             OR fn_pode_avaliar($2, t.id_diretoria)) AS pode_ver,
            (SELECT COALESCE(json_agg(json_build_object(
                'id_questao', q.id_questao, 'ordem', q.ordem, 'enunciado', q.enunciado,
                'alternativas', (SELECT json_agg(json_build_object('numero', al.numero, 'texto', al.texto)
                                                 ORDER BY al.numero)
                                 FROM alternativa al WHERE al.id_questao = q.id_questao))
              ORDER BY q.ordem), '[]')
             FROM questao q WHERE q.id_avaliacao = a.id_avaliacao) AS questoes
     FROM avaliacao a
     JOIN modulo mo ON mo.id_modulo = a.id_modulo
     JOIN trilha t  ON t.id_trilha  = mo.id_trilha
     WHERE a.id_avaliacao = $1`,
    [idAvaliacao, idUsuario]
  );
  return rows[0] || null;
}

async function chamarQuiz(client, { idUsuario, idAvaliacao, respostas }) {
  const { rows } = await client.query('CALL sp_responder_quiz($1, $2, $3::jsonb, NULL, NULL, NULL)', [
    idUsuario,
    idAvaliacao,
    JSON.stringify(respostas),
  ]);
  return {
    id_tentativa: Number(rows[0].p_id_tentativa),
    percentual: Number(rows[0].p_percentual),
    decisao: rows[0].p_decisao,
  };
}

// Portfólio interno (RF10): só desafios APROVADOS do usuário, com link e parecer.
// Não é uma tabela nova: é uma consulta sobre conclusão + resultado (AB1, glossário).
async function portfolio(idUsuario) {
  const { rows } = await pool.query(
    `SELECT tr.titulo AS trilha, a.titulo AS avaliacao, t.link_projeto, t.descricao_entrega,
            r.parecer, av.nome AS avaliador, c.concluida_em AS aprovado_em, p.pontos
     FROM conclusao c
     JOIN participacao_avaliacao pa ON pa.id_participacao = c.id_participacao
     JOIN matricula m               ON m.id_matricula     = pa.id_matricula
     JOIN avaliacao a               ON a.id_avaliacao     = pa.id_avaliacao AND a.tipo = 'projeto'
     JOIN modulo mo                 ON mo.id_modulo       = a.id_modulo
     JOIN trilha tr                 ON tr.id_trilha       = mo.id_trilha
     JOIN tentativa_avaliacao t     ON t.id_tentativa     = c.id_tentativa
     JOIN resultado_tentativa r     ON r.id_tentativa     = c.id_tentativa
     LEFT JOIN usuario av           ON av.id_usuario      = r.id_avaliador
     JOIN pontuacao p               ON p.id_participacao  = c.id_participacao
     WHERE m.id_usuario = $1
     ORDER BY c.concluida_em DESC`,
    [idUsuario]
  );
  return rows;
}

// RF07 · histórico das entregas de quem está logado numa avaliação: todas as tentativas, com
// a decisão e o parecer quando já existem. Tentativa sem resultado = aguardando parecer.
async function minhasTentativas(idAvaliacao, idUsuario) {
  const { rows } = await pool.query(
    `SELECT t.id_tentativa, t.numero, t.enviada_em, t.link_projeto, t.descricao_entrega,
            r.decisao, r.percentual_acerto, r.parecer, r.avaliada_em, av.nome AS avaliador
     FROM tentativa_avaliacao t
     JOIN participacao_avaliacao pa ON pa.id_participacao = t.id_participacao
     JOIN matricula m               ON m.id_matricula     = pa.id_matricula
     LEFT JOIN resultado_tentativa r ON r.id_tentativa    = t.id_tentativa
     LEFT JOIN usuario av            ON av.id_usuario     = r.id_avaliador
     WHERE pa.id_avaliacao = $1 AND m.id_usuario = $2
     ORDER BY t.numero DESC`,
    [idAvaliacao, idUsuario]
  );
  return rows;
}

// RF12 · painel do gestor (tela 11): números da(s) diretoria(s) que ele pode gerir e os membros
// com o progresso de cada matrícula. O escopo é o mesmo da fila: fn_pode_avaliar.
async function resumoDoGestor(idUsuario) {
  const numeros = await pool.query(
    `WITH escopo AS (
       SELECT d.id_diretoria FROM diretoria d WHERE fn_pode_avaliar($1, d.id_diretoria)
     )
     SELECT
       (SELECT count(*)::int FROM vw_fila_avaliacao f
         WHERE f.id_diretoria IN (SELECT id_diretoria FROM escopo) AND f.id_membro <> $1) AS aguardando,
       (SELECT count(DISTINCT v.id_usuario)::int FROM vinculo_diretoria v
         JOIN usuario u ON u.id_usuario = v.id_usuario AND u.ativo
         WHERE v.papel = 'membro' AND v.ativo AND v.id_diretoria IN (SELECT id_diretoria FROM escopo)) AS membros_ativos,
       (SELECT count(*)::int FROM trilha t
         WHERE t.status = 'publicada' AND t.id_diretoria IN (SELECT id_diretoria FROM escopo)) AS trilhas_publicadas,
       (SELECT COALESCE(round(avg(p.percentual)), 0)::int FROM vw_progresso_membro p
         JOIN trilha t ON t.id_trilha = p.id_trilha
         JOIN usuario u ON u.id_usuario = p.id_usuario AND u.ativo
         WHERE t.id_diretoria IN (SELECT id_diretoria FROM escopo)) AS progresso_medio`,
    [idUsuario]
  );
  const membros = await pool.query(
    `SELECT u.id_usuario, u.nome, t.titulo AS trilha, p.percentual::float AS percentual,
            p.avaliacoes_concluidas, p.avaliacoes_exigidas
     FROM vw_progresso_membro p
     JOIN trilha t  ON t.id_trilha  = p.id_trilha
     JOIN usuario u ON u.id_usuario = p.id_usuario AND u.ativo
     WHERE fn_pode_avaliar($1, t.id_diretoria) AND p.percentual < 100
     ORDER BY p.id_matricula DESC
     LIMIT $2`,
    [idUsuario, 6]
  );
  return { ...numeros.rows[0], membros: membros.rows };
}

module.exports = {
  resumoDoGestor,
  minhasTentativas,
  portfolio,
  autenticar,
  usuarioAtivo,
  perfil,
  trilhaParaUsuario,
  quizParaResponder,
  chamarQuiz,
  topRanking,
  rankingCompleto,
  rankingDoUsuario,
  posicaoPorSql,
  contarParticipantes,
  chamarParecer,
  chamarEnvio,
  donoDaTentativa,
  progressoDaMatricula,
  proximaAvaliacao,
  filaDoGestor,
};
