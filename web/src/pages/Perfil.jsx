export default function Perfil({ usuario }) {
  return (
    <section aria-labelledby="titulo-perfil">
      <div className="titulo-pagina">
        <span className="rotulo">Quem faz parte da jornada</span>
        <h1 id="titulo-perfil">Perfil do membro</h1>
        <p>Um espaço para reconhecer quem aprende e constrói junto.</p>
      </div>
      <div className="perfil-card">
        <img className="perfil-imagem" src={usuario.imagem} alt={`Foto de ${usuario.nome}`} width="120" height="120" />
        <h2>{usuario.nome}</h2>
        <p className="perfil-cargo">{usuario.cargo} · {usuario.organizacao}</p>
        <span className="xp">{usuario.xp} XP</span>
        <div className="conquistas">
          <h2>Emblemas &amp; Conquistas</h2>
          <div className="conquistas-lista">
            <div className="conquista conquista-amber">
              <span className="conquista-icone" aria-hidden="true">🌟</span>
              <div>
                <p className="conquista-titulo">História MEJ</p>
                <p className="conquista-descricao">Completou Fase 1</p>
              </div>
            </div>
            <div className="conquista conquista-sky">
              <span className="conquista-icone" aria-hidden="true">🎯</span>
              <div>
                <p className="conquista-titulo">Cultura Viva</p>
                <p className="conquista-descricao">3 Estrelas obtidas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
