// Mascote do EJ Quest: o foguete do protótipo (Figma, componente mascote/foguete), em SVG.
export default function Mascote({ tamanho = 128 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 128 128" role="img" aria-label="Foguete do EJ Quest">
      <path d="M64 6c18 14 28 36 28 60v22H36V66c0-24 10-46 28-60z" fill="#f4f4f5" />
      <path d="M64 6c9 7 16 16 21 27H43C48 22 55 13 64 6z" fill="#e3161e" />
      <circle cx="64" cy="62" r="17" fill="#e3161e" />
      <circle cx="58" cy="60" r="4" fill="#111214" />
      <circle cx="70" cy="60" r="4" fill="#111214" />
      <path d="M57 69q7 6 14 0" stroke="#111214" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M36 70L18 92v8l18-8zM92 70l18 22v8l-18-8z" fill="#e3161e" />
      <path d="M50 88h28l-6 14H56z" fill="#9ca3af" />
      <path d="M56 102h16l-8 20z" fill="#f59e0b" />
      <path d="M60 102h8l-4 11z" fill="#facc15" />
    </svg>
  );
}
