# 05 · Definição de pronto

Um item só está pronto quando:

1. Cumpre o critério de aceite do requisito que cita (`02-requisitos.md`).
2. Passou no gate da fase, com evidência guardada.
3. O caminho infeliz foi testado (pelo menos um: Redis fora, dado duplicado, permissão, concorrência).
4. Consultas são parametrizadas e nenhum segredo foi commitado.
5. O capítulo do manual foi atualizado na seção "Como ficou no projeto".
6. **O Fideles consegue explicar o item em voz alta sem ler o código.**

A AB2 de BD2 está pronta quando: o fluxo de envio, aprovação e consulta do ranking funciona; a
duplicidade e a gravação parcial estão impedidas; o ranking opera com e sem Redis; as 100 mil
tentativas podem ser geradas; os experimentos têm resultados registrados; e o repositório sobe com
`docker compose up` e os scripts. Tela bonita, sozinha, não atende.
