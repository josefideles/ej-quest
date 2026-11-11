# EJ Quest

Protótipo visual de uma plataforma gamificada de gestão do conhecimento e capacitação para empresas juniores, desenvolvido para a AB1 de Programação Web I.

## 1. Quem precisa da solução?

Empresas juniores são o público-alvo. A RocketJR é o contexto proposto para organizar conteúdos e apoiar a integração de membros. Trata-se de uma proposta acadêmica, sem pesquisa ou validação institucional declarada.

## 2. Qual problema resolve?

Materiais dispersos dificultam o acesso ao conhecimento e geram repetição de orientações. A proposta completa é organizar esses materiais em trilhas de aprendizagem. Esta entrega demonstra apenas a interface, sem disponibilizar conteúdos ou acompanhar o aprendizado.

## 3. Como funciona o protótipo?

- **Header:** nome EJ Quest e 200 XP ilustrativos.
- **Jornada:** quatro paradas com imagens locais, números, títulos e descrições: Conheça a EJ, Ferramentas de trabalho, Processos e projetos e Próximos passos.
- **Perfil:** foto de Gabriel Fideles, cargo Membro, organização RocketJR, XP e emblemas demonstrativos.
- **Navbar:** alterna entre Jornada e Perfil; Ranking e Desafios estão desativados, com “Em breve”.

## Tecnologias

- **React e JavaScript:** componentes, dados e navegação com `useState`.
- **JSX:** estrutura da interface.
- **CSS puro:** estilos, Flexbox, Grid nos emblemas e media queries.
- **Vite:** desenvolvimento e build.
- **Imagens locais SVG e PNG:** ilustrações e foto do perfil.

## Requisitos acadêmicos atendidos

| Requisito | Implementação |
| --- | --- |
| Divisão do layout | Header, conteúdo principal e Navbar |
| Estilização de textos | Fonte, tamanho, peso e cor |
| Estilização de imagens | Dimensões, bordas e formato |
| Flexbox | Alinhamento e distribuição dos elementos |
| React e JSX | Construção da interface |
| Componentes | Header, Navbar e Parada reutilizável |

## Como executar

Requer Node.js 22.12 ou superior e npm. Dentro de `ej-quest-ab1/`:

```bash
npm ci            # Instalar dependências
npm run dev       # Iniciar desenvolvimento
npm run build     # Gerar build em dist/
```

Abra o endereço informado pelo Vite no terminal.

## Limitações

Dados estáticos, sem backend, banco de dados, login ou progressão funcional. As paradas não abrem conteúdos; XP e emblemas não são atualizados pelas ações do usuário.
