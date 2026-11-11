FROM node:22-slim
WORKDIR /app

# Copia só os manifestos primeiro: o Docker reaproveita a camada de dependências
# enquanto package.json e package-lock.json não mudarem.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

EXPOSE 3000
CMD ["node", "src/index.js"]
