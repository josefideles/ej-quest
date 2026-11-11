export default function Parada({ numero, titulo, descricao, imagem, alt }) {
  return (
    <article className="parada">
      <img className="parada-imagem" src={imagem} alt={alt} width="104" height="104" />
      <div className="parada-texto">
        <span className="rotulo">Etapa {numero}</span>
        <h2>{titulo}</h2>
        <p>{descricao}</p>
      </div>
    </article>
  );
}
