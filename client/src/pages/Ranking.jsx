// Tela 07 · Ranking (RF11). Duas fontes, as duas no Redis:
//   - GET /ranking: top 100 em Cache-Aside (string JSON com TTL de 60 s; sem cache, calcula no
//     PostgreSQL pela vw_ranking_consolidado e guarda). "origem" diz de onde veio.
//   - GET /ranking/eu: minha posição no Sorted Set (ZREVRANK), mantido por Write-Through.
// "Atualizado há X s" mostra o gerado_em do cache: o ranking pode atrasar, nunca inventar.
import { useEffect, useState } from 'react';
import { FiClock } from 'react-icons/fi';
import { api, mensagemDeErro } from '../api';
import { Avatar, Carregando, Erro } from '../components/Comuns';
import Xp from '../components/Xp';

function primeiroNome(nome) {
  const partes = nome.split(' ');
  return `${partes[0]} ${partes[1] ? partes[1][0] + '.' : ''}`;
}

export default function Ranking({ usuario }) {
  const [ranking, setRanking] = useState(null);
  const [eu, setEu] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([api.get('/ranking'), api.get('/ranking/eu')])
      .then(([r, e]) => {
        setRanking(r.data);
        setEu(e.data);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  if (erro) return <Erro mensagem={erro} />;
  if (!ranking) return <Carregando />;

  const segundos = Math.max(0, Math.round((Date.now() - new Date(ranking.gerado_em).getTime()) / 1000));
  const [primeiro, segundo, terceiro] = ranking.participantes;
  const resto = ranking.participantes.slice(3, 20);
  const euNoTopo = ranking.participantes.some((p) => Number(p.id_usuario) === Number(usuario.id_usuario));

  return (
    <section className="ranking">
      <h1>Ranking geral</h1>
      <p className="texto-fraco linha-icone">
        <FiClock /> Atualizado há {segundos} s · {ranking.total_participantes.toLocaleString('pt-BR')} participantes · fonte: {ranking.origem}
      </p>

      <div className="podio">
        {[segundo, primeiro, terceiro].filter(Boolean).map((p) => (
          <div key={p.id_usuario} className={`degrau degrau-${p.posicao}`}>
            <Avatar nome={p.nome} tamanho={p.posicao === 1 ? 60 : 50} destaque={p.posicao === 1} />
            <span className="degrau-nome">{primeiroNome(p.nome)}</span>
            <div className="degrau-bloco">
              <strong>{p.posicao}º</strong>
              <small>{p.total_pontos.toLocaleString('pt-BR')} XP</small>
            </div>
          </div>
        ))}
      </div>

      {eu && !euNoTopo && (
        <div className="linha-ranking eu">
          <span className="posicao">{eu.posicao.toLocaleString('pt-BR')}</span>
          <Avatar nome={usuario.nome} tamanho={34} />
          <span className="nome">{usuario.nome} <small>(você)</small></span>
          <Xp valor={eu.total_pontos} />
        </div>
      )}

      {resto.map((p) => (
        <div key={p.id_usuario} className={Number(p.id_usuario) === Number(usuario.id_usuario) ? 'linha-ranking eu' : 'linha-ranking'}>
          <span className="posicao">{p.posicao}</span>
          <Avatar nome={p.nome} tamanho={34} />
          <span className="nome">{p.nome}</span>
          <Xp valor={p.total_pontos} />
        </div>
      ))}
    </section>
  );
}
