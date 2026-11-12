# Capítulo 4 · Carga de 140 mil tentativas: `generate_series` e reprodutibilidade

> **Objetivo:** explicar como os dados de teste foram gerados, por que são confiáveis e como
> repetir.
>
> **Tempo de leitura:** ~15 min · **Arquivo:** `db/05_povoamento.sql`

---

## 4.1 O cenário

A plataforma atendendo uma rede de EJs: **6.000 usuários** (1 gestor geral, 3 gestores, 5.996
membros, 1 em cada 50 desligado), **3 diretorias**, **6 trilhas** com 3 módulos, 2 lições e 1 quiz
de 3 questões por módulo, e um desafio no último módulo.

| Tabela | Linhas |
|---|---|
| `tentativa_avaliacao` | **140.574** |
| `resposta_tentativa` | 378.225 |
| `resultado_tentativa` | 139.108 |
| `participacao_avaliacao` | 43.230 |
| `conclusao` = `pontuacao` | 34.101 |
| `matricula` | 11.992 |
| Desafios aguardando parecer | 1.466 |

## 4.2 A técnica

```sql
INSERT INTO usuario (nome, email, ...)
SELECT 'Nome ' || n, 'usuario' || n || '@ejquest.test', ...
FROM generate_series(1, 6000) AS n;
```

🧠 `generate_series(1, 6000)` gera 6.000 linhas numeradas. Um `INSERT ... SELECT` sobre ela cria
6.000 registros num comando só, muito mais rápido que 6.000 INSERTs.

🧠 **N tentativas por participação:** cada participação sorteia `k` (de 1 a 6) e um
`CROSS JOIN LATERAL generate_series(1, p.k)` gera `k` linhas para ela. `LATERAL` deixa a função
usar a coluna `p.k` da linha da esquerda.

## 4.3 Reprodutível (RNF10)

- `SELECT setseed(0.42)`: o `random()` passa a gerar sempre a mesma sequência.
- Paralelismo desligado no script: workers paralelos teriam sementes próprias.
- Data de referência fixa (`2026-11-12 12:00`), em vez de `now()`.

Resultado: rodar `./scripts/recriar-banco.sh` de novo gera **exatamente** a mesma carga, e as
medições podem ser repetidas por qualquer pessoa.

## 4.4 A carga respeita as regras (e isso é argumento)

Uma carga "solta" encheria as tabelas com qualquer coisa. Esta segue as regras de negócio:

- **Respostas primeiro, nota depois:** o resultado do quiz é calculado a partir das respostas
  gravadas, como o servidor faria. Nenhum percentual é inventado.
- **RN07:** em cada participação, só a **última** tentativa pode ser aprovada.
- **RN06:** só existe desafio para quem concluiu os 3 quizzes da trilha.
- **RN08:** no máximo um envio de desafio aguardando parecer por participação.
- **Pontos pela trigger:** as 34.101 pontuações nasceram da mesma trigger que a API usa.
- **Dados fictícios:** nomes sintéticos, e-mails no domínio reservado `.test`, nenhum membro real.

❓ **"Esses dados são realistas?"** → Volume e proporções foram escolhidos, não observados.
Servem para medir desempenho e testar regras, não para tirar conclusão sobre EJs reais.

✍️ **Minhas notas**
>
