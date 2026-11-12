// Envio de desafio, progresso do membro e fila do gestor (RF07, RF09, RF08, RN06 a RN08, RN11).
// Escrito pelo agente em 12/11/2026 (DEC-009).
const { pool } = require('../db');
const { emTransacao } = require('../transacao');
const { ErroHttp } = require('../erros');

// Membro envia link e descrição do desafio. As regras (matrícula, quizzes antes, um envio
// aguardando por vez, nada depois de aprovado) estão na procedure enviar_projeto.
async function enviarProjeto({ idUsuario, idAvaliacao, link, descricao }) {
  return emTransacao(async (client) => {
    const { rows } = await client.query('CALL enviar_projeto($1, $2, $3, $4, NULL, NULL)', [
      idUsuario,
      idAvaliacao,
      link,
      descricao,
    ]);
    return { id_tentativa: Number(rows[0].p_id_tentativa), numero: rows[0].p_numero };
  });
}

// Quem pode ver o progresso de uma matrícula: o próprio membro, o gestor geral ou um gestor
// da diretoria da trilha. Conferido no servidor (constituição, item 3).
async function obterProgresso({ idMatricula, idUsuario }) {
  const { rows } = await pool.query(
    `SELECT p.id_matricula, p.id_usuario, p.id_trilha, tr.titulo AS trilha,
            p.avaliacoes_exigidas, p.avaliacoes_concluidas, p.percentual,
            (p.id_usuario = $2 OR fn_pode_avaliar($2, tr.id_diretoria)) AS pode_ver
     FROM vw_progresso_membro p
     JOIN trilha tr ON tr.id_trilha = p.id_trilha
     WHERE p.id_matricula = $1`,
    [idMatricula, idUsuario]
  );
  if (rows.length === 0) throw new ErroHttp(404, 'Matrícula não encontrada');
  const p = rows[0];
  if (!p.pode_ver) throw new ErroHttp(403, 'Sem permissão para ver esta matrícula');

  // Próxima atividade: a primeira avaliação ainda não concluída, na ordem dos módulos
  // (quiz antes do desafio dentro do mesmo módulo).
  const { rows: proxima } = await pool.query(
    `SELECT a.id_avaliacao, a.tipo, a.titulo, mo.ordem AS modulo
     FROM avaliacao a
     JOIN modulo mo ON mo.id_modulo = a.id_modulo
     WHERE mo.id_trilha = $1 AND a.obrigatoria
       AND NOT EXISTS (SELECT 1 FROM participacao_avaliacao pa
                       JOIN conclusao c ON c.id_participacao = pa.id_participacao
                       WHERE pa.id_matricula = $2 AND pa.id_avaliacao = a.id_avaliacao)
     ORDER BY mo.ordem, (a.tipo = 'projeto'), a.id_avaliacao
     LIMIT 1`,
    [p.id_trilha, idMatricula]
  );

  return {
    id_matricula: Number(p.id_matricula),
    trilha: p.trilha,
    exigidas: p.avaliacoes_exigidas,
    concluidas: p.avaliacoes_concluidas,
    percentual: Number(p.percentual),
    proxima: proxima[0]
      ? { ...proxima[0], id_avaliacao: Number(proxima[0].id_avaliacao) }
      : null, // null = trilha concluída (RN11)
  };
}

// Fila de entregas aguardando parecer, só do escopo do gestor, das mais antigas primeiro.
async function obterFila({ idUsuario, limite = 50 }) {
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
  return rows.map((r) => ({ ...r, id_tentativa: Number(r.id_tentativa), id_membro: Number(r.id_membro) }));
}

module.exports = { enviarProjeto, obterProgresso, obterFila };
