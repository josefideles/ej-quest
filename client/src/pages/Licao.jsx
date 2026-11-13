// Tela 03 · Lição (RF05). O texto mora no PostgreSQL (licao.texto); o link externo só aponta
// para o material (Drive, YouTube) e não dá permissão sobre o arquivo.
// A lição vem dentro da trilha (GET /trilhas/:id), que já traz módulos e lições em ordem.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiX, FiExternalLink, FiChevronRight } from 'react-icons/fi';
import { api, mensagemDeErro } from '../api';
import { BarraProgresso, Carregando, Erro } from '../components/Comuns';

export default function Licao() {
  const { idTrilha, idLicao } = useParams();
  const navegar = useNavigate();
  const [trilha, setTrilha] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get(`/trilhas/${idTrilha}`).then((r) => setTrilha(r.data)).catch((e) => setErro(mensagemDeErro(e)));
  }, [idTrilha]);

  if (erro) return <main className="tela-foco"><Erro mensagem={erro} /></main>;
  if (!trilha) return <main className="tela-foco"><Carregando /></main>;

  const modulo = trilha.modulos.find((m) => m.licoes.some((l) => String(l.id_licao) === idLicao));
  const posicao = modulo.licoes.findIndex((l) => String(l.id_licao) === idLicao);
  const licao = modulo.licoes[posicao];
  const proxima = modulo.licoes[posicao + 1];
  const quiz = modulo.avaliacoes.find((a) => a.tipo === 'quiz');

  function avancar() {
    if (proxima) navegar(`/trilhas/${idTrilha}/licoes/${proxima.id_licao}`);
    else if (quiz) navegar(`/avaliacoes/${quiz.id_avaliacao}/quiz`);
    else navegar('/');
  }

  return (
    <main className="tela-foco">
      <header className="topo-foco">
        <button type="button" className="icone-botao" onClick={() => navegar('/')} aria-label="Fechar e voltar à jornada"><FiX /></button>
        <BarraProgresso percentual={((posicao + 1) / modulo.licoes.length) * 100} cor="vermelho" altura={12} />
      </header>

      <article className="corpo-foco">
        <span className="rotulo vermelho-texto">{modulo.titulo} · Lição {posicao + 1} de {modulo.licoes.length}</span>
        <h1>{licao.titulo}</h1>
        {licao.texto.split('\n').map((paragrafo, i) => <p key={i}>{paragrafo}</p>)}

        {licao.url_externa && (
          <a className="material" href={licao.url_externa} target="_blank" rel="noreferrer">
            <span className="material-icone"><FiExternalLink /></span>
            <span className="material-texto">
              <strong>Material complementar</strong>
              <small>Abre em outra aba</small>
            </span>
            <FiChevronRight />
          </a>
        )}
      </article>

      <footer className="rodape-foco">
        <button type="button" className="botao botao-vermelho" onClick={avancar}>
          {proxima ? 'Próxima lição' : quiz && !quiz.concluida ? 'Ir para o quiz' : 'Voltar à jornada'}
        </button>
      </footer>
    </main>
  );
}
