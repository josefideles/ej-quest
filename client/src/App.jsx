// Rotas da aplicação (React Router, aula 08 de PW1). A sessão (token + usuário) fica num
// useState aqui no topo e desce para as páginas por props.
import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { lerSessao, salvarSessao, api } from './api';
import Moldura from './components/Moldura';
import Login from './pages/Login';
import Jornada from './pages/Jornada';
import Licao from './pages/Licao';
import Quiz from './pages/Quiz';
import ResultadoQuiz from './pages/ResultadoQuiz';
import Desafio from './pages/Desafio';
import Ranking from './pages/Ranking';
import Perfil from './pages/Perfil';
import Gestao from './pages/Gestao';
import AvaliarEntrega from './pages/AvaliarEntrega';

// Gestor = gestor geral ou quem tem vínculo de gestor em alguma diretoria (RF02, RF12).
export function ehGestor(usuario) {
  return Boolean(usuario?.gestor_geral || usuario?.vinculos?.some((v) => v.papel === 'gestor'));
}

export default function App() {
  const [sessao, setSessao] = useState(lerSessao);

  function entrar(novaSessao) {
    salvarSessao(novaSessao);
    setSessao(novaSessao);
  }

  async function sair() {
    try {
      await api.post('/logout');
    } finally {
      salvarSessao(null);
      setSessao(null);
    }
  }

  if (!sessao) {
    return (
      <Routes>
        <Route path="/login" element={<Login onEntrar={entrar} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const usuario = sessao.usuario;
  const gestor = ehGestor(usuario);
  const inicio = gestor && usuario.matriculas.length === 0 ? '/gestao' : '/';

  return (
    <Routes>
      {/* Telas com barra superior e navegação (inferior no celular, lateral no desktop) */}
      <Route element={<Moldura usuario={usuario} gestor={gestor} onSair={sair} />}>
        <Route path="/" element={<Jornada usuario={usuario} />} />
        <Route path="/ranking" element={<Ranking usuario={usuario} />} />
        <Route path="/perfil" element={<Perfil usuario={usuario} onSair={sair} />} />
        {gestor && <Route path="/gestao" element={<Gestao usuario={usuario} />} />}
      </Route>
      {/* Telas de foco, sem navegação: lição, quiz, resultado, desafio, avaliação */}
      <Route path="/trilhas/:idTrilha/licoes/:idLicao" element={<Licao />} />
      <Route path="/avaliacoes/:idAvaliacao/quiz" element={<Quiz />} />
      <Route path="/avaliacoes/:idAvaliacao/resultado" element={<ResultadoQuiz />} />
      <Route path="/avaliacoes/:idAvaliacao/desafio" element={<Desafio />} />
      {gestor && <Route path="/gestao/entregas/:idTentativa" element={<AvaliarEntrega />} />}
      <Route path="/login" element={<Navigate to={inicio} replace />} />
      <Route path="*" element={<Navigate to={inicio} replace />} />
    </Routes>
  );
}
