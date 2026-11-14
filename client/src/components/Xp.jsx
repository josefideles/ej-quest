import { FiZap } from 'react-icons/fi';

// Selo de XP (pontos). Formata com separador de milhar brasileiro: 1.240.
export default function Xp({ valor, grande = false }) {
  return (
    <span className={grande ? 'xp xp-grande' : 'xp'} aria-label={`${valor ?? 0} XP`}>
      <FiZap />
      {valor === null || valor === undefined ? '...' : Number(valor).toLocaleString('pt-BR')}
    </span>
  );
}
