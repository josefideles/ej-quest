// Telas 09 e 11 · Gestão (RF08, RF12). A mesma página serve ao celular (tela 09) e ao desktop
// (tela 11): no desktop os blocos ficam lado a lado. Só aparece para quem é gestor.
// Escopo no servidor: o gestor de diretoria vê só a própria diretoria; o gestor geral vê tudo
// (fn_pode_avaliar no PostgreSQL). A tela não decide permissão, só mostra o que a API devolve.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiInbox, FiChevronRight } from 'react-icons/fi';
import { api, mensagemDeErro } from '../api';
import { Avatar, BarraProgresso, Carregando, Erro, tempoDesde } from '../components/Comuns';

export default function Gestao({ usuario }) {
  const navegar = useNavigate();
  const [resumo, setResumo] = useState(null);
  const [fila, setFila] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([api.get('/gestao/resumo'), api.get('/fila')])
      .then(([r, f]) => {
        setResumo(r.data);
        setFila(f.data.entregas);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  const escopo = usuario.gestor_geral
    ? 'Gestor geral · todas as diretorias'
    : usuario.vinculos.filter((v) => v.papel === 'gestor').map((v) => v.diretoria).join(', ') + ' · você é gestor';

  return (
    <section className="gestao">
      <h1>Gestão</h1>
      <p className="texto-fraco">{escopo}</p>
      <Erro mensagem={erro} />

      {!resumo ? <Carregando /> : (
        <>
          <div className="numeros">
            <div className="numero-card"><span>Aguardando parecer</span><strong className="amarelo-texto">{resumo.aguardando}</strong></div>
            <div className="numero-card"><span>Membros ativos</span><strong className="azul-texto">{resumo.membros_ativos.toLocaleString('pt-BR')}</strong></div>
            <div className="numero-card"><span>Trilhas publicadas</span><strong className="verde-texto">{resumo.trilhas_publicadas}</strong></div>
            <div className="numero-card"><span>Progresso médio</span><strong className="amarelo-texto">{resumo.progresso_medio}%</strong></div>
          </div>

          <div className="gestao-colunas">
            <article className="cartao">
              <h2 className="linha-icone"><FiInbox /> Fila de avaliações</h2>
              {fila.length === 0 && <p className="texto-fraco">Nenhuma entrega aguardando parecer.</p>}
              {fila.slice(0, 8).map((e) => (
                <button key={e.id_tentativa} type="button" className="item-fila"
                  onClick={() => navegar(`/gestao/entregas/${e.id_tentativa}`, { state: e })}>
                  <Avatar nome={e.membro} tamanho={36} />
                  <span className="item-texto">
                    <strong>{e.membro}</strong>
                    <small>{e.trilha} · {tempoDesde(e.enviada_em)}</small>
                  </span>
                  <span className="botao-avaliar">Avaliar</span>
                  <FiChevronRight className="so-celular" />
                </button>
              ))}
              {fila.length > 8 && <p className="texto-fraco">e mais {fila.length - 8} na fila (mais antigas primeiro).</p>}
            </article>

            <article className="cartao">
              <h2>Acompanhamento dos membros</h2>
              {resumo.membros.map((m) => (
                <div key={`${m.id_usuario}-${m.trilha}`} className="acompanhamento">
                  <Avatar nome={m.nome} tamanho={34} />
                  <div className="acompanhamento-texto">
                    <div className="tentativa-linha"><strong>{m.nome}</strong><span className="amarelo-texto">{Math.round(m.percentual)}%</span></div>
                    <BarraProgresso percentual={m.percentual} cor={m.percentual >= 70 ? 'verde' : 'amarelo'} altura={6} />
                    <small className="texto-fraco">{m.trilha} · {m.avaliacoes_concluidas} de {m.avaliacoes_exigidas} avaliações</small>
                  </div>
                </div>
              ))}
            </article>
          </div>
        </>
      )}
    </section>
  );
}
