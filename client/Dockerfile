# Front do EJ Quest em duas etapas:
#   1) node: instala as dependências e gera o build estático do React (npm run build -> dist/)
#   2) nginx: serve o dist/ e repassa /api para o contêiner da API (ver nginx.conf)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
