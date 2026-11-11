import { useState } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Jornada from './pages/Jornada';
import Perfil from './pages/Perfil';
import imagemPerfil from './assets/perfil-gabriel-fideles.png';
import './App.css';

const usuario = {
  nome: 'Gabriel Fideles',
  cargo: 'Membro',
  organizacao: 'RocketJR',
  xp: 200,
  imagem: imagemPerfil,
};

export default function App() {
  const [pagina, setPagina] = useState('jornada');

  return (
    <div className="aplicacao">
      <Header xp={usuario.xp} />
      <main id="conteudo">
        {pagina === 'jornada' ? <Jornada /> : <Perfil usuario={usuario} />}
      </main>
      <Navbar pagina={pagina} onNavegar={setPagina} />
    </div>
  );
}
