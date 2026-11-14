// Cliente HTTP do front (axios, como na aula 13 de PW1).
// Todas as chamadas vão para "/api/...": o Vite (dev) ou o nginx (Docker) repassam para a API.
// O front NUNCA fala com o PostgreSQL ou o Redis: só a API tem as credenciais dos bancos.
import axios from 'axios';

const CHAVE_SESSAO = 'ejquest.sessao';

export const api = axios.create({ baseURL: '/api' });

export function lerSessao() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_SESSAO));
  } catch {
    return null;
  }
}

export function salvarSessao(sessao) {
  if (sessao) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  else localStorage.removeItem(CHAVE_SESSAO);
}

// Toda requisição leva o token do login no cabeçalho Authorization.
api.interceptors.request.use((config) => {
  const sessao = lerSessao();
  if (sessao?.token) config.headers.Authorization = `Bearer ${sessao.token}`;
  return config;
});

// Token vencido ou usuário desligado (401): limpa a sessão e volta para o login.
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    if (erro.response?.status === 401 && lerSessao()) {
      salvarSessao(null);
      window.location.assign('/login');
    }
    return Promise.reject(erro);
  }
);

// Mensagem de erro legível: a API sempre responde { erro: "..." }.
export function mensagemDeErro(erro) {
  return erro.response?.data?.erro || 'Não foi possível falar com o servidor. Ele está ligado?';
}
