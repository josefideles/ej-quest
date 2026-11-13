// Tela 04 · Quiz (RF06). Uma questão por vez, uma resposta por questão. O gabarito NUNCA vem
// para o navegador: o GET /avaliacoes/:id não traz o campo "correta", e quem corrige é a
// procedure sp_responder_quiz no PostgreSQL (RN05, mínimo de 70%).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { api, mensagemDeErro } from '../api';
import { BarraProgresso, Carregando, Erro } from '../components/Comuns';

export default function Quiz() {
  const { idAvaliacao } = useParams();
  const navegar = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState({}); // { id_questao: numero_da_alternativa }
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get(`/avaliacoes/${idAvaliacao}`).then((r) => setQuiz(r.data)).catch((e) => setErro(mensagemDeErro(e)));
  }, [idAvaliacao]);

  if (!quiz) {
    return <main className="tela-foco">{erro ? <Erro mensagem={erro} /> : <Carregando />}</main>;
  }

  const questao = quiz.questoes[atual];
  const ultima = atual === quiz.questoes.length - 1;
  const escolhida = respostas[questao.id_questao];

  async function avancar() {
    if (!ultima) {
      setAtual(atual + 1);
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const lista = Object.entries(respostas).map(([id, alternativa]) => ({ id_questao: Number(id), alternativa }));
      const { data } = await api.post(`/avaliacoes/${idAvaliacao}/respostas`, { respostas: lista });
      navegar(`/avaliacoes/${idAvaliacao}/resultado`, {
        replace: true,
        state: { ...data, total: quiz.questoes.length, minimo: quiz.percentual_minimo, pontos: quiz.pontos_previstos },
      });
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <main className="tela-foco">
      <header className="topo-foco">
        <button type="button" className="icone-botao" onClick={() => navegar('/')} aria-label="Sair do quiz"><FiX /></button>
        <BarraProgresso percentual={((atual + 1) / quiz.questoes.length) * 100} altura={12} />
        <span className="contador">{atual + 1}/{quiz.questoes.length}</span>
      </header>

      <section className="corpo-foco">
        <span className="rotulo amarelo-texto">Quiz · {quiz.titulo}</span>
        <h1>{questao.enunciado}</h1>
        <div className="alternativas" role="radiogroup">
          {questao.alternativas.map((alt) => (
            <button key={alt.numero} type="button" role="radio" aria-checked={escolhida === alt.numero}
              className={escolhida === alt.numero ? 'alternativa escolhida' : 'alternativa'}
              onClick={() => setRespostas({ ...respostas, [questao.id_questao]: alt.numero })}>
              <span className="numero">{alt.numero}</span>
              <span>{alt.texto}</span>
            </button>
          ))}
        </div>
        <Erro mensagem={erro} />
      </section>

      <footer className="rodape-foco">
        <button type="button" className="botao botao-vermelho" disabled={!escolhida || enviando} onClick={avancar}>
          {enviando ? 'Enviando...' : ultima ? 'Enviar respostas' : 'Próxima questão'}
        </button>
      </footer>
    </main>
  );
}
