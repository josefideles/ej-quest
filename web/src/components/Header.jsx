export default function Header({ xp }) {
  return (
    <header className="cabecalho">
      <div className="marca">
        <span className="marca-simbolo" aria-hidden="true">EQ</span>
        <div>
          <span className="marca-nome">EJ <span>Quest</span></span>
          <p>Conhecimento que conecta</p>
        </div>
      </div>
      <span className="xp" aria-label={`${xp} XP ilustrativos`}>{xp} XP</span>
    </header>
  );
}
