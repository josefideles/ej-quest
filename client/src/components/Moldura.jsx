// Moldura das telas principais: barra superior (marca + XP) e navegação.
// No celular a navegação fica embaixo (Figma, telas 02, 07, 08, 09); no desktop vira barra
// lateral (Figma, tela 11). É o mesmo componente: só o CSS muda com a largura da tela.
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FiMap, FiBarChart2, FiUser, FiGrid, FiLogOut } from 'react-icons/fi';
import { api } from '../api';
import Mascote from './Mascote';
import Xp from './Xp';

export default function Moldura({ usuario, gestor, onSair }) {
  const [pontos, setPontos] = useState(null);

  // XP do topo = total de pontos no ranking (GET /ranking/eu, Sorted Set do Redis).
  useEffect(() => {
    api.get('/ranking/eu').then((r) => setPontos(r.data.total_pontos)).catch(() => setPontos(0));
  }, []);

  const links = [
    { para: '/', rotulo: 'Jornada', icone: <FiMap /> },
    { para: '/ranking', rotulo: 'Ranking', icone: <FiBarChart2 /> },
    { para: '/perfil', rotulo: 'Perfil', icone: <FiUser /> },
  ];
  if (gestor) links.push({ para: '/gestao', rotulo: 'Gestão', icone: <FiGrid /> });

  return (
    <div className="moldura">
      <header className="barra-superior">
        <div className="marca">
          <Mascote tamanho={28} />
          <span>EJ QUEST</span>
        </div>
        <Xp valor={pontos} />
      </header>

      <nav className="navegacao" aria-label="Navegação principal">
        <div className="marca marca-lateral">
          <Mascote tamanho={30} />
          <span>EJ QUEST</span>
        </div>
        {links.map((link) => (
          <NavLink key={link.para} to={link.para} end className="nav-item">
            {link.icone}
            <span>{link.rotulo}</span>
          </NavLink>
        ))}
        <button type="button" className="nav-item nav-sair" onClick={onSair}>
          <FiLogOut />
          <span>Sair</span>
        </button>
        <p className="nav-usuario">{usuario.nome}</p>
      </nav>

      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
