export default function Navbar({ pagina, onNavegar }) {
  return (
    <nav className="navbar" aria-label="Navegação principal">
      <button type="button" className={pagina === 'jornada' ? 'aba-ativa' : ''} aria-current={pagina === 'jornada' ? 'page' : undefined} onClick={() => onNavegar('jornada')}>
        Jornada
      </button>
      <button type="button" disabled>Ranking <small>Em breve</small></button>
      <button type="button" disabled>Desafios <small>Em breve</small></button>
      <button type="button" className={pagina === 'perfil' ? 'aba-ativa' : ''} aria-current={pagina === 'perfil' ? 'page' : undefined} onClick={() => onNavegar('perfil')}>
        Perfil
      </button>
    </nav>
  );
}
