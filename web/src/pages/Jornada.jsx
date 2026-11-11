import Parada from '../components/Parada';
import conheca from '../assets/conheca-ej.svg';
import ferramentas from '../assets/ferramentas.svg';
import processos from '../assets/processos.svg';
import proximos from '../assets/proximos-passos.svg';

const paradas = [
  { id: 'conheca-ej', titulo: 'Conheça a EJ', descricao: 'Descubra o propósito da empresa júnior e o papel de cada membro.', imagem: conheca, alt: 'Ilustração de uma sede com uma bandeira verde' },
  { id: 'ferramentas', titulo: 'Ferramentas de trabalho', descricao: 'Conheça os recursos que ajudam a organizar documentos, conversas e tarefas.', imagem: ferramentas, alt: 'Ilustração de uma pasta com documentos organizados' },
  { id: 'processos', titulo: 'Processos e projetos', descricao: 'Entenda o caminho de uma ideia, do planejamento à entrega em equipe.', imagem: processos, alt: 'Ilustração de um quadro com três colunas de tarefas' },
  { id: 'proximos-passos', titulo: 'Próximos passos', descricao: 'Prepare-se para aplicar o aprendizado e participar dos primeiros projetos.', imagem: proximos, alt: 'Ilustração de degraus que levam a uma bandeira' },
];

export default function Jornada() {
  return (
    <section aria-labelledby="titulo-jornada">
      <div className="titulo-pagina">
        <span className="rotulo">Trilha de aprendizagem · 4 paradas</span>
        <h1 id="titulo-jornada">Fundamentos da EJ</h1>
        <p>Conheça a empresa júnior e prepare-se para participar dos primeiros projetos.</p>
      </div>
      <div className="trilha">
        {paradas.map((parada, indice) => (
          <Parada key={parada.id} numero={indice + 1} titulo={parada.titulo} descricao={parada.descricao} imagem={parada.imagem} alt={parada.alt} />
        ))}
      </div>
    </section>
  );
}
