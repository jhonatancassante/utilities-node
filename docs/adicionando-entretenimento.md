# Adicionando uma nova área de entretenimento

A área de entretenimento é independente do catálogo de ferramentas de trabalho. Ela mantém suas próprias rotas e seu próprio registro, sem alterar os endereços existentes em \`/tools\`.

## Estrutura

\`\`\`text
configs/entertainment.js
pages/entertainment/index.js
pages/entertainment/<slug>/index.js
features/<slug>/components/
features/<slug>/lib/
tests/unit/features/<slug>/
\`\`\`

O registro em \`configs/entertainment.js\` alimenta o submenu do cabeçalho e o catálogo em \`/entertainment\`. Identificadores, diretórios e URLs permanecem em inglês; os textos apresentados às pessoas usuárias ficam em português.

As aplicações de entretenimento são públicas por padrão. Não devem exigir login nem adicionar permissões administrativas sem uma necessidade específica.

## Criador de Aventuras de Magic

A aplicação \`/entertainment/mtg-adventure-creator\` utiliza a API pública da Scryfall para selecionar cinco cartas, nesta ordem:

1. O problema: criatura ou encantamento.
2. O cenário: terreno não básico.
3. A solução: artefato ou feitiço (sorcery).
4. O ajudante: criatura.
5. O antagonista: criatura.

A busca prioriza impressões em português (\`lang:pt\`) e utiliza uma impressão em inglês apenas quando não existe resultado em português para o filtro daquele papel. A mesma carta Oracle não é repetida na aventura.

As requisições são realizadas pelo endpoint público interno \`/api/v1/entertainment/mtg-adventure\`, que consulta a Scryfall no servidor. Até 31 de dezembro de 2026, a interface prioriza a imagem JPEG \`large\`; a partir de 1º de janeiro de 2027, prioriza \`display\` em WebP.

Consulte a [documentação da API da Scryfall](https://scryfall.com/docs/api) antes de ampliar o uso da integração.
