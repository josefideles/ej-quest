# DEC-011 · Prefixos da aula 5 (vw_, sp_, trg_, fn_) e imutabilidade por trigger

- **Contexto:** a aula 5 de BD2 (Visões, Procedures e Triggers) recomenda como boa prática prefixos claros no catálogo: `vw_` para visões, `sp_` para procedures e `trg_` para triggers. As procedures do projeto não seguiam (`aprovar_projeto`). A mesma aula mostra triggers `BEFORE` com `OLD`/`NEW` para impedir operações, e a regra "se der para resolver com constraint, prefira constraint". A RN18 (resultado, conclusão e recompensa imutáveis) estava garantida só pela ausência de rota de edição.
- **Decisão:** procedures renomeadas para `sp_aprovar_projeto`, `sp_pedir_ajustes` e `sp_enviar_projeto`; funções auxiliares mantêm `fn_`. A RN18 passa a ser garantida no banco por `trg_resultado_imutavel`, `trg_conclusao_imutavel` e `trg_pontuacao_imutavel` (`BEFORE UPDATE OR DELETE`, função `fn_bloquear_alteracao`, erro `EJ409`). Constraint não serve aqui: CHECK, FK e UNIQUE não conseguem proibir UPDATE ou DELETE.
- **Evidência:** `docs/resultados/testes-banco.txt`, seção "Imutabilidade".
- **Quem decidiu:** agente, a partir dos materiais de BD2 (DEC-009) · **Data:** 12/11/2026 · **Situação:** vigente
