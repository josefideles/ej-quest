# EJ Quest · front-end (client/)

Interface React + Vite do EJ Quest, feita a partir do protótipo no Figma (telas 01 a 11).
A primeira versão (AB1 de Programação Web I) era um protótipo estático com Jornada e Perfil;
esta versão consome a API real.

| Tela | Rota | Requisitos |
|---|---|---|
| 01 Login | `/login` | RF01 |
| 02 Jornada | `/` | RF04, RF05, RF09 |
| 03 Lição | `/trilhas/:idTrilha/licoes/:idLicao` | RF05 |
| 04 Quiz e 05 Resultado | `/avaliacoes/:id/quiz` e `/resultado` | RF06 |
| 06 Desafio | `/avaliacoes/:id/desafio` | RF07, RF08 |
| 07 Ranking | `/ranking` | RF11 |
| 08 Perfil e portfólio | `/perfil` | RF09, RF10 |
| 09 e 11 Gestão (celular e desktop) | `/gestao` | RF08, RF12 |
| 10 Avaliar entrega | `/gestao/entregas/:id` | RF08 |

Conceitos de PW1 aplicados: componentes e props, React Router (páginas e rotas), react-icons,
`onChange`/`onClick` com `useState`, renderização condicional e de listas, requisições com `axios`.

## Rodar

Com Docker (recomendado, na raiz do repositório): `docker compose up -d --build` e abra
http://localhost:8080.

Em modo de desenvolvimento, com a API já de pé na porta 3000:

```bash
cd client
npm install
npm run dev      # http://localhost:5173 (o Vite repassa /api para a API)
```
