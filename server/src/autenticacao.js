// Autenticação (RF01, RNF04, RN17). Escrito pelo agente em 12/11/2026 (DEC-009, DEC-014).
//
// 1. POST /login manda e-mail e senha. O BANCO confere a senha (bcrypt, fn_autenticar).
// 2. A API devolve um token assinado: base64url(dados) + "." + base64url(HMAC-SHA256(dados, segredo)).
//    É a mesma ideia de um JWT, escrita com o módulo "crypto" do próprio Node (sem dependência).
// 3. Nas próximas requisições, o front manda  Authorization: Bearer <token>.
//    A API confere a assinatura (ninguém consegue forjar sem o segredo), a validade (8 h) e se o
//    usuário continua ativo no banco (desligado perde o acesso na hora, RN17).
//
// Modo demonstração (PERMITIR_CABECALHO_USUARIO=1, padrão local): aceita também o cabeçalho
// X-Usuario-Id, usado pelos scripts de teste e de medição (DEC-004). Use 0 num ambiente real.
const crypto = require('crypto');
const sql = require('./repositorios/postgres');

const SEGREDO = process.env.TOKEN_SEGREDO || 'troque-este-segredo-local';
const PERMITIR_CABECALHO = process.env.PERMITIR_CABECALHO_USUARIO !== '0';
const VALIDADE_SEGUNDOS = 8 * 60 * 60;

const b64 = (texto) => Buffer.from(texto).toString('base64url');
const assinar = (dados) => crypto.createHmac('sha256', SEGREDO).update(dados).digest('base64url');

function gerarToken(idUsuario) {
  const expiraEm = Math.floor(Date.now() / 1000) + VALIDADE_SEGUNDOS;
  const dados = b64(JSON.stringify({ sub: idUsuario, exp: expiraEm }));
  return { token: `${dados}.${assinar(dados)}`, expira_em: new Date(expiraEm * 1000).toISOString() };
}

// Devolve o id do usuário, ou null se o token for inválido, adulterado ou vencido.
function verificarToken(token) {
  const [dados, assinatura] = String(token).split('.');
  if (!dados || !assinatura) return null;
  const esperado = Buffer.from(assinar(dados));
  const recebido = Buffer.from(assinatura);
  // timingSafeEqual: compara em tempo constante (não vaza, pelo tempo, quantos caracteres batem).
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(dados, 'base64url').toString());
    if (!Number.isInteger(sub) || exp < Date.now() / 1000) return null;
    return sub;
  } catch {
    return null;
  }
}

// Middleware: descobre quem está chamando e põe em req.usuarioId (ou null).
async function identificar(req, res, next) {
  req.usuarioId = null;
  const autorizacao = req.get('Authorization');
  if (autorizacao && autorizacao.startsWith('Bearer ')) {
    const id = verificarToken(autorizacao.slice(7));
    if (!id) return res.status(401).json({ erro: 'Token inválido ou expirado' });
    try {
      if (!(await sql.usuarioAtivo(id))) return res.status(401).json({ erro: 'Usuário desligado' });
    } catch (erro) {
      return next(erro);
    }
    req.usuarioId = id;
    return next();
  }
  const cabecalho = req.get('X-Usuario-Id');
  if (cabecalho && PERMITIR_CABECALHO) {
    const id = Number(cabecalho);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'X-Usuario-Id deve ser um número inteiro positivo' });
    }
    req.usuarioId = id;
  }
  next();
}

function exigirUsuario(req, res, next) {
  if (!req.usuarioId) {
    return res.status(401).json({ erro: 'Faça login (Authorization: Bearer <token>)' });
  }
  next();
}

module.exports = { gerarToken, verificarToken, identificar, exigirUsuario };
