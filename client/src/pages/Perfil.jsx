// Tela 08 · Perfil e portfólio (RF09, RF10, RF12). O portfólio não é uma tabela nova: é uma
// consulta sobre conclusão → tentativa → resultado (só desafios aprovados). O progresso de cada
// trilha vem da vw_progresso_membro.
import { useEffect, useState } from 'react';
import { FiBriefcase, FiLink, FiLogOut } from 'react-icons/fi';
import { api, mensagemDeErro } from '../api';
import { Avatar, BarraProgresso, Carregando, Chip, Erro, dataCurta } from '../components/Comuns';

export default function Perfil({ usuario, onSair }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/ranking/eu'),
      api.get('/eu/portfolio'),
      ...usuario.matriculas.map((m) => api.get(`/matriculas/${m.id_matricula}/progresso`)),
    ])
      .then(([eu, portfolio, ...progressos]) => setDados({
        eu: eu.data, projetos: portfolio.data.projetos, progressos: progressos.map((p) => p.data),
      }))
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [usuario]);

  const vinculo = usuario.vinculos[0];

  return (
    <section className="perfil">
      <div className="perfil-topo">
        <Avatar nome={usuario.nome} tamanho={84} destaque />
        <h1>{usuario.nome}</h1>
        <p className="texto-fraco">
          {usuario.gestor_geral ? 'Gestor geral' : vinculo ? `${vinculo.papel === 'gestor' ? 'Gestor' : 'Membro'} · ${vinculo.diretoria}` : 'Sem diretoria'}
        </p>
      </div>

      <Erro mensagem={erro} />
      {!dados ? <Carregando /> : (
        <>
          <div className="estatisticas">
            <div className="estatistica"><strong className="amarelo-texto">{dados.eu.total_pontos.toLocaleString('pt-BR')}</strong><small>XP total</small></div>
            <div className="estatistica"><strong className="vermelho-texto">{dados.eu.posicao ? `${dados.eu.posicao.toLocaleString('pt-BR')}º` : '-'}</strong><small>No ranking</small></div>
            <div className="estatistica"><strong className="verde-texto">{dados.projetos.length}</strong><small>Desafio{dados.projetos.length === 1 ? '' : 's'} aprovado{dados.projetos.length === 1 ? '' : 's'}</small></div>
          </div>

          <span className="rotulo">Minhas trilhas</span>
          {dados.progressos.length === 0 && <p className="texto-fraco">Nenhuma matrícula.</p>}
          {dados.progressos.map((p) => (
            <article key={p.id_matricula} className="cartao">
              <div className="tentativa-linha">
                <strong>{p.trilha}</strong>
                <Chip status={p.percentual >= 100 ? 'concluida' : 'andamento'} />
              </div>
              <BarraProgresso percentual={p.percentual} cor={p.percentual >= 100 ? 'verde' : 'amarelo'} altura={8} />
            </article>
          ))}

          <span className="rotulo">Portfólio</span>
          {dados.projetos.length === 0 && <p className="texto-fraco">Os desafios aprovados aparecem aqui.</p>}
          {dados.projetos.map((p) => (
            <article key={p.link_projeto} className="cartao cartao-verde">
              <div className="tentativa-linha">
                <strong className="linha-icone"><FiBriefcase /> {p.avaliacao} · {p.trilha}</strong>
                <Chip status="aprovada" />
              </div>
              <a className="link linha-icone" href={p.link_projeto} target="_blank" rel="noreferrer"><FiLink /> {p.link_projeto}</a>
              <small className="texto-fraco">Aprovado em {dataCurta(p.aprovado_em)} por {p.avaliador} · “{p.parecer}”</small>
            </article>
          ))}

          <button type="button" className="botao botao-escuro so-celular" onClick={onSair}><FiLogOut /> Sair</button>
        </>
      )}
    </section>
  );
}
