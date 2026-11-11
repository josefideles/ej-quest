# 00 · Constituição do projeto

Princípios que valem para qualquer mudança. Mudar um deles exige uma decisão registrada em
`decisoes/`.

1. **Dados primeiro.** Toda mudança é planejada de baixo para cima: banco → API → tela.
2. **O PostgreSQL é a fonte oficial.** Nada que só exista no Redis pode ser necessário para
   reconstruir o sistema. Se o Redis sumir, o ranking é refeito a partir do SQL.
3. **A API é a única porta.** Permissão, validação e regra de negócio moram na API e no banco.
   Esconder um botão na tela nunca é proteção.
4. **O banco se defende sozinho.** Restrições (PK, FK, UNIQUE, CHECK) protegem a integridade mesmo
   se a API tiver bug. A regra crítica (aprovação e pontos) roda dentro do banco, numa transação.
5. **Uma recompensa por conclusão, sempre.** Nenhum caminho (clique duplo, duas abas, dois
   gestores, repetição após queda) pode gerar ponto duplicado.
6. **Histórico não se apaga.** Desligar membro, arquivar trilha ou pedir ajuste preserva
   tentativas, resultados e pareceres.
7. **O caminho infeliz faz parte da entrega.** Redis fora, banco fora, permissão negada: a API
   responde em JSON, sem detalhe interno, e não inventa dado.
8. **Medir antes de afirmar.** Nenhum ganho de desempenho é anunciado sem número medido, com
   ambiente e carga registrados.
9. **Sem evidência, não está pronto.** Saída de comando, `EXPLAIN`, contagem ou print.
10. **Quem apresenta entende.** Código que o Fideles não consegue explicar não entra.
