// Tela 10 · Avaliar entrega (RF08, RNF02, RNF03): o coração de BD2.
// "Aprovar" chama a procedure sp_aprovar_projeto numa transação: trava a participação
// (SELECT ... FOR UPDATE), confere se já existe conclusão, grava resultado + conclusão, e a
// trigger concede os pontos. Dois gestores aprovando ao mesmo tempo: o segundo espera e recebe
// "ja_aprovada", sem ponto duplicado. Depois do COMMIT a API atualiza o Redis.
// "Solicitar ajustes" exige parecer (CHECK no banco). O gestor não avalia a própria entrega.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiExternalLink } from 'react-icons/fi';
import { api, mensagemDeErro } from '../api';
import { Avatar, Carregando, Chip, Erro } from '../components/Comuns';

export default function AvaliarEntrega() {
  const { idTentativa } = useParams();
  const { state } = useLocation();
  const navegar = useNavigate();
  const [entrega, setEntrega] = useState(state || null);
  const [parecer, setParecer] = useState('');
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Abriu a URL direto (sem vir da fila)? Busca a entrega na fila do gestor.
  useEffect(() => {
    if (entrega) return;
    api.get('/fila', { params: { limite: 1000 } })
      .then((r) => {
        const achada = r.data.entregas.find((e) => String(e.id_tentativa) === idTentativa);
        if (achada) setEntrega(achada);
        else setErro('Esta entrega não está na sua fila (já avaliada ou fora do seu escopo).');
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [entrega, idTentativa]);

  async function decidir(acao) {
    setErro('');
    setEnviando(true);
    try {
      const { data } = await api.post(`/tentativas/${idTentativa}/${acao}`, { parecer });
      setResultado({ acao, ...data });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="tela-foco rolavel">
      <header className="topo-foco">
        <button type="button" className="icone-botao" onClick={() => navegar('/gestao')} aria-label="Voltar à gestão"><FiArrowLeft /></button>
        <strong>Avaliar entrega</strong>
      </header>

      <section className="corpo-foco">
        {!entrega ? (erro ? <Erro mensagem={erro} /> : <Carregando />) : (
          <>
            <article className="cartao">
              <div className="tentativa-linha">
                <span className="linha-icone"><Avatar nome={entrega.membro} tamanho={44} destaque /> <span><strong>{entrega.membro}</strong><br /><small className="texto-fraco">{entrega.trilha} · tentativa {entrega.numero}</small></span></span>
                <Chip status={resultado ? (resultado.acao === 'aprovar' ? 'aprovada' : 'ajustes') : 'aguardando'} />
              </div>
            </article>

            <article className="cartao">
              <span className="rotulo">Entrega</span>
              <a className="link linha-icone" href={entrega.link_projeto} target="_blank" rel="noreferrer"><FiExternalLink /> {entrega.link_projeto}</a>
              {entrega.descricao_entrega && <p>“{entrega.descricao_entrega}”</p>}
            </article>

            {resultado ? (
              <article className="cartao cartao-verde">
                <strong>{resultado.acao === 'aprovar' ? 'Entrega aprovada.' : 'Ajustes solicitados.'}</strong>
                <p className="texto-fraco">
                  Resposta do banco: {resultado.status}.{' '}
                  {resultado.acao === 'aprovar' && (resultado.placar_atualizado ? 'Pontos concedidos e placar do Redis atualizado.' : 'Ranking será recalculado na próxima leitura.')}
                </p>
                <button type="button" className="botao botao-escuro" onClick={() => navegar('/gestao')}>Voltar à fila</button>
              </article>
            ) : (
              <div className="formulario">
                <label className="campo">
                  <span>Parecer (obrigatório para ajustes)</span>
                  <textarea rows={3} value={parecer} onChange={(e) => setParecer(e.target.value)} placeholder="Ficou ótimo, critérios atendidos." />
                </label>
                <Erro mensagem={erro} />
                <button type="button" className="botao botao-verde" disabled={enviando} onClick={() => decidir('aprovar')}>Aprovar entrega</button>
                <button type="button" className="botao botao-escuro" disabled={enviando} onClick={() => decidir('ajustes')}>Solicitar ajustes</button>
                <p className="nota-rodape">A aprovação é definitiva: gera a conclusão e os pontos uma única vez.</p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
