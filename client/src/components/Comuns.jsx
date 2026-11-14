// Componentes pequenos reaproveitados em várias telas (aula 06 de PW1: componentes + props).

export function BarraProgresso({ percentual, cor = 'amarelo', altura = 10 }) {
  const valor = Math.max(0, Math.min(100, Number(percentual) || 0));
  return (
    <div className="barra" style={{ height: altura }} role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100}>
      <div className={`barra-preenchida ${cor}`} style={{ width: `${valor}%` }} />
    </div>
  );
}

// Chip de status: aprovado (verde), ajustes/aguardando (amarelo/azul), etc.
const CHIPS = {
  aprovada: { texto: 'Aprovado', classe: 'verde' },
  ajustes: { texto: 'Ajustes solicitados', classe: 'azul' },
  reprovada: { texto: 'Reprovado', classe: 'vermelho' },
  aguardando: { texto: 'Aguardando parecer', classe: 'amarelo' },
  andamento: { texto: 'Em andamento', classe: 'amarelo' },
  concluida: { texto: 'Concluída', classe: 'verde' },
};

export function Chip({ status, texto }) {
  const chip = CHIPS[status] || { texto: status, classe: 'cinza' };
  return <span className={`chip ${chip.classe}`}>{texto || chip.texto}</span>;
}

// Avatar com as iniciais do nome ("Gabriel Fideles" -> "GF").
export function Avatar({ nome, tamanho = 40, destaque = false }) {
  const iniciais = (nome || '?')
    .split(' ')
    .filter((p) => /^[A-Za-zÀ-ú]/.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
  return (
    <span className={destaque ? 'avatar avatar-destaque' : 'avatar'} style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36 }}>
      {iniciais}
    </span>
  );
}

export function Carregando() {
  return <p className="aviso-carregando">Carregando...</p>;
}

export function Erro({ mensagem }) {
  return mensagem ? <p className="aviso-erro" role="alert">{mensagem}</p> : null;
}

export function dataCurta(iso) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
}

export function tempoDesde(iso) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}
