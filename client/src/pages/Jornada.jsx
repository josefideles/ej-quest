// Tela 02 · Jornada (RF04, RF05, RF09). A trilha vira um caminho de "paradas": lições e quiz de
// cada módulo e, no fim, o desafio (projeto prático). Regras do protótipo:
//   - leitura em ordem recomendada, sem bloqueio das lições e quizzes;
//   - o desafio só abre depois de todos os quizzes da trilha (RN06);
//   - progresso = avaliações concluídas / exigidas (RN11), vindo da vw_progresso_membro.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiCheck, FiHelpCircle, FiAward, FiLock } from 'react-icons/fi';
import { api, mensagemDeErro } from '../api';
import { BarraProgresso, Carregando, Erro } from '../components/Comuns';
import Mascote from '../components/Mascote';

// Monta a sequência de paradas e marca o status de cada uma.
function montarParadas(trilha) {
  const quizzes = trilha.modulos.flatMap((m) => m.avaliacoes.filter((a) => a.tipo === 'quiz'));
  const quizzesFeitos = quizzes.every((q) => q.concluida);
  const modulos = trilha.modulos.map((modulo) => {
    const quizDoModulo = modulo.avaliacoes.find((a) => a.tipo === 'quiz');
    const paradas = [
      ...modulo.licoes.map((l) => ({
        chave: `l${l.id_licao}`, tipo: 'licao', titulo: l.titulo, id: l.id_licao,
        concluida: Boolean(quizDoModulo?.concluida),
      })),
      ...modulo.avaliacoes.map((a) => ({
        chave: `a${a.id_avaliacao}`, tipo: a.tipo === 'quiz' ? 'quiz' : 'desafio', titulo: a.titulo, id: a.id_avaliacao,
        concluida: a.concluida, bloqueada: a.tipo === 'projeto' && !quizzesFeitos && !a.concluida, pontos: a.pontos,
      })),
    ];
    return { ...modulo, paradas };
  });
  // "Atual" = a primeira parada ainda não concluída e não bloqueada.
  const atual = modulos.flatMap((m) => m.paradas).find((p) => !p.concluida && !p.bloqueada);
  if (atual) atual.atual = true;
  return modulos;
}

const DESLOCAMENTOS = [0, 60, -50, 30, -70, 50]; // zigue-zague do caminho, como no Figma

export default function Jornada({ usuario }) {
  const navegar = useNavigate();
  const matriculas = usuario.matriculas;
  const [indice, setIndice] = useState(0);
  const [trilha, setTrilha] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState('');

  const matricula = matriculas[indice];

  useEffect(() => {
    if (!matricula) return;
    setTrilha(null);
    Promise.all([
      api.get(`/trilhas/${matricula.id_trilha}`),
      api.get(`/matriculas/${matricula.id_matricula}/progresso`),
    ])
      .then(([t, p]) => {
        setTrilha(t.data);
        setProgresso(p.data);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [matricula]);

  if (!matricula) {
    return <p className="vazio">Você ainda não está matriculado em nenhuma trilha. Fale com a gestão da sua EJ.</p>;
  }

  function abrir(parada) {
    if (parada.bloqueada) return;
    if (parada.tipo === 'licao') navegar(`/trilhas/${trilha.id_trilha}/licoes/${parada.id}`);
    else if (parada.tipo === 'quiz') navegar(`/avaliacoes/${parada.id}/quiz`);
    else navegar(`/avaliacoes/${parada.id}/desafio`);
  }

  const modulos = trilha ? montarParadas(trilha) : [];
  let contador = 0;

  return (
    <section className="jornada">
      {matriculas.length > 1 && (
        <div className="abas" role="tablist">
          {matriculas.map((m, i) => (
            <button key={m.id_matricula} role="tab" aria-selected={i === indice} className={i === indice ? 'aba ativa' : 'aba'} onClick={() => setIndice(i)}>
              {m.trilha}
            </button>
          ))}
        </div>
      )}

      <Erro mensagem={erro} />
      {!trilha ? <Carregando /> : (
        <>
          <article className="card-trilha">
            <span className="rotulo">Trilha · {trilha.descricao}</span>
            <h1>{trilha.titulo}</h1>
            <BarraProgresso percentual={progresso?.percentual} />
            <p>{progresso?.concluidas} de {progresso?.exigidas} avaliações concluídas · {progresso?.percentual}%</p>
          </article>

          {modulos.map((modulo) => (
            <div key={modulo.id_modulo} className="modulo">
              <div className="divisor"><span>{modulo.titulo}</span></div>
              {modulo.paradas.map((parada) => {
                const deslocamento = DESLOCAMENTOS[contador++ % DESLOCAMENTOS.length];
                const Icone = parada.concluida ? FiCheck : parada.bloqueada ? FiLock
                  : parada.tipo === 'quiz' ? FiHelpCircle : parada.tipo === 'desafio' ? FiAward : FiBookOpen;
                const classe = ['parada', parada.tipo, parada.concluida && 'concluida', parada.bloqueada && 'bloqueada', parada.atual && 'atual']
                  .filter(Boolean).join(' ');
                return (
                  <div key={parada.chave} className="linha-parada" style={{ transform: `translateX(${deslocamento}px)` }}>
                    <button type="button" className={classe} onClick={() => abrir(parada)} disabled={parada.bloqueada}
                      title={parada.bloqueada ? 'O desafio abre depois de todos os quizzes da trilha' : parada.titulo}>
                      <Icone />
                    </button>
                    {(parada.atual || parada.tipo === 'desafio') && (
                      <div className={parada.atual ? 'balao atual' : 'balao'}>
                        <strong>{parada.atual ? 'COMEÇAR' : 'DESAFIO FINAL'}</strong>
                        <span>{parada.titulo}</span>
                      </div>
                    )}
                    {parada.atual && <span className="mascote-lado"><Mascote tamanho={44} /></span>}
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
