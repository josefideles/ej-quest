// Tela 06 · Desafio / projeto prático (RF07, RF08, RN06, RN07, RN08).
// Cada envio é uma tentativa nova e as antigas ficam no histórico. Só pode haver uma entrega
// aguardando parecer por vez: a procedure sp_enviar_projeto recusa a segunda (409), e a tela
// já esconde o formulário nesse caso. O desafio só abre depois dos quizzes (RN06, 409 também).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiAward } from 'react-icons/fi';
import { api, mensagemDeErro } from '../api';
import { Carregando, Chip, Erro, dataCurta } from '../components/Comuns';

export default function Desafio() {
  const { idAvaliacao } = useParams();
  const navegar = useNavigate();
  const [desafio, setDesafio] = useState(null);
  const [tentativas, setTentativas] = useState([]);
  const [link, setLink] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [enviando, setEnviando] = useState(false);

  function carregar() {
    return Promise.all([
      api.get(`/avaliacoes/${idAvaliacao}`),
      api.get(`/avaliacoes/${idAvaliacao}/minhas-tentativas`),
    ])
      .then(([d, t]) => {
        setDesafio(d.data);
        setTentativas(t.data.tentativas);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }

  useEffect(() => {
    carregar();
  }, [idAvaliacao]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setSucesso('');
    setEnviando(true);
    try {
      await api.post(`/avaliacoes/${idAvaliacao}/tentativas`, { link_projeto: link, descricao_entrega: descricao });
      setLink('');
      setDescricao('');
      setSucesso('Entrega enviada. Agora é com a gestão: o parecer aparece aqui.');
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  if (!desafio) return <main className="tela-foco">{erro ? <Erro mensagem={erro} /> : <Carregando />}</main>;

  const aguardando = tentativas.some((t) => !t.decisao);
  const aprovado = tentativas.some((t) => t.decisao === 'aprovada');

  return (
    <main className="tela-foco rolavel">
      <header className="topo-foco">
        <button type="button" className="icone-botao" onClick={() => navegar('/')} aria-label="Voltar à jornada"><FiArrowLeft /></button>
        <strong>Desafio final</strong>
      </header>

      <section className="corpo-foco">
        <article className="card-desafio">
          <div className="desafio-cabecalho">
            <span className="desafio-icone"><FiAward /></span>
            <div>
              <h1>{desafio.titulo}</h1>
              <small>Vale {desafio.pontos_previstos} XP · entra no seu portfólio</small>
            </div>
          </div>
          <p>{desafio.instrucoes}</p>
        </article>

        <article className="cartao">
          <span className="rotulo">Suas entregas</span>
          {tentativas.length === 0 && <p className="texto-fraco">Nenhuma entrega ainda.</p>}
          {tentativas.map((t) => (
            <div key={t.id_tentativa} className="tentativa">
              <div className="tentativa-linha">
                <strong>Tentativa {t.numero} · {dataCurta(t.enviada_em)}</strong>
                <Chip status={t.decisao || 'aguardando'} />
              </div>
              <a href={t.link_projeto} target="_blank" rel="noreferrer" className="link">{t.link_projeto}</a>
              {t.parecer && (
                <blockquote className="parecer">
                  “{t.parecer}”
                  <small>Parecer de {t.avaliador}</small>
                </blockquote>
              )}
            </div>
          ))}
        </article>

        {!aprovado && (
          <form className="cartao formulario" onSubmit={enviar}>
            <span className="rotulo">Nova entrega</span>
            <label className="campo">
              <span>Link do repositório ou da aplicação</span>
              <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://github.com/..." required disabled={aguardando} />
            </label>
            <label className="campo">
              <span>O que você fez</span>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o que mudou desde a entrega anterior" rows={3} disabled={aguardando} />
            </label>
            <Erro mensagem={erro} />
            {sucesso && <p className="aviso-sucesso">{sucesso}</p>}
            <button className="botao botao-vermelho" type="submit" disabled={aguardando || enviando}>
              {enviando ? 'Enviando...' : 'Enviar para avaliação'}
            </button>
            <p className="nota-rodape">Enquanto uma entrega aguarda parecer, não dá para enviar outra.</p>
          </form>
        )}
      </section>
    </main>
  );
}
