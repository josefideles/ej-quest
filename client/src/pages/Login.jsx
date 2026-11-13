// Tela 01 · Login (RF01). onChange nos campos, onClick/onSubmit no botão e useState para o erro
// (aula 10 de PW1). A senha é conferida no PostgreSQL (bcrypt, fn_autenticar); a API devolve
// um token assinado, válido por 8 h.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mensagemDeErro } from '../api';
import Mascote from '../components/Mascote';
import { Erro } from '../components/Comuns';

export default function Login({ onEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();

  async function entrar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { data } = await api.post('/login', { email, senha });
      onEntrar({ token: data.token, usuario: data.usuario });
      navegar('/');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="tela-login">
      <Mascote tamanho={128} />
      <h1 className="logo-texto">EJ QUEST</h1>
      <p className="subtitulo">O conhecimento da EJ não vai embora com quem sai.</p>

      <form className="formulario" onSubmit={entrar}>
        <label className="campo">
          <span>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario10@ejquest.test" autoComplete="username" required />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
        </label>
        <Erro mensagem={erro} />
        <button className="botao botao-vermelho" type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="nota-rodape">Não tem acesso? Fale com a gestão da sua EJ.</p>
    </main>
  );
}
