// Identificação SIMULADA do usuário, só para a demonstração de BD2.
//
// Em vez de login com senha e token (que fica para a AB2 de PW1), quem chama a API manda o
// cabeçalho  X-Usuario-Id: 12  e a API confia nele. Isso NÃO é segurança: é um atalho declarado
// para focar no banco. Diga isso na apresentação.
function usuarioSimulado(req, res, next) {
  const valor = req.get('X-Usuario-Id');
  if (!valor) {
    req.usuarioId = null;
    return next();
  }
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'X-Usuario-Id deve ser um número inteiro positivo' });
  }
  req.usuarioId = id;
  next();
}

function exigirUsuario(req, res, next) {
  if (!req.usuarioId) {
    return res.status(401).json({ erro: 'Envie o cabeçalho X-Usuario-Id' });
  }
  next();
}

module.exports = { usuarioSimulado, exigirUsuario };
