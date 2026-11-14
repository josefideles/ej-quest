// Tela 05 · Resultado do quiz (RF06, RN05, RN09). Se aprovou, a procedure gravou resultado +
// conclusão numa transação só e a trigger concedeu os pontos uma única vez. Reprovou: mesma
// tela em vermelho, com "Tentar de novo" (RN07: cada envio é uma tentativa nova).
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiZap, FiCheck, FiClock } from 'react-icons/fi';
import Mascote from '../components/Mascote';

export default function ResultadoQuiz() {
  const { idAvaliacao } = useParams();
  const { state } = useLocation();
  const navegar = useNavigate();
  if (!state) return <Navigate to="/" replace />;

  const aprovado = state.decisao === 'aprovada';
  const acertos = Math.round((state.percentual / 100) * state.total);

  return (
    <main className={aprovado ? 'tela-foco resultado aprovado' : 'tela-foco resultado reprovado'}>
      <section className="corpo-foco centro">
        <Mascote tamanho={150} />
        <h1 className="titulo-resultado">{aprovado ? 'QUIZ APROVADO!' : 'AINDA NÃO FOI'}</h1>
        <p className="subtitulo">
          Você acertou {acertos} de {state.total} questões ({state.percentual}%). O mínimo era {state.minimo}%.
        </p>
        <div className="recompensas">
          <div className="recompensa amarela">
            <span className="rotulo">XP ganho</span>
            <strong><FiZap /> +{aprovado ? state.pontos : 0}</strong>
          </div>
          <div className={aprovado ? 'recompensa verde' : 'recompensa vermelha'}>
            <span className="rotulo">Acertos</span>
            <strong><FiCheck /> {state.percentual}%</strong>
          </div>
        </div>
        {aprovado && (
          <p className="aviso-ranking">
            <FiClock /> Seu ranking pode levar alguns instantes para atualizar.
          </p>
        )}
      </section>
      <footer className="rodape-foco">
        {aprovado ? (
          <button type="button" className="botao botao-verde" onClick={() => navegar('/')}>Continuar</button>
        ) : (
          <>
            <button type="button" className="botao botao-vermelho" onClick={() => navegar(`/avaliacoes/${idAvaliacao}/quiz`, { replace: true })}>Tentar de novo</button>
            <button type="button" className="botao botao-escuro" onClick={() => navegar('/')}>Voltar à jornada</button>
          </>
        )}
      </footer>
    </main>
  );
}
