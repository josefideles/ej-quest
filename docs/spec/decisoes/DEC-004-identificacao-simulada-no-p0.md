# DEC-004 · Identificação simulada por cabeçalho até a fase de PW1

- **Contexto:** login com senha e sessão não é conceito avaliado em BD2 e custa horas que faltam até 13/11.
- **Decisão:** no P0, a API identifica o usuário pelo cabeçalho `X-Usuario-Id`. Login real (bcrypt + sessão/JWT, RF01) entra na fase de PW1.
- **Consequências:** **não é segurança** e deve ser dito na apresentação como recorte. As regras de escopo (gestor só da própria diretoria, sem autoaprovação) continuam checadas na API e na procedure usando esse id.
- **Quem decidiu:** Fideles (proposta do plano de 10/11) · **Data:** 10/11/2026 · **Situação:** substituída em parte pela DEC-014 (12/11/2026): o login real existe; o cabeçalho ficou só como modo demonstração
