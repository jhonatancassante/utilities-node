# Adicionando uma nova ferramenta

As ferramentas da aplicação seguem uma estrutura comum para manter a navegação, as páginas e os componentes consistentes. O Gerador de QR Code é a implementação de referência.

## Estrutura

Cada ferramenta é registrada em `configs/tools.js` e possui uma rota própria no Pages Router. A implementação específica fica isolada em `features/`.

```text
configs/tools.js                              registro central das ferramentas
components/ToolPage/                          estrutura compartilhada das páginas
components/Button/                            botão reutilizável
pages/tools/index.js                          catálogo de ferramentas (/tools)
pages/tools/<slug>/index.js                   página da ferramenta (/tools/<slug>)
features/<slug>/components/                   componentes React e CSS Modules da ferramenta
features/<slug>/lib/                           lógica auxiliar independente de React
tests/unit/features/<slug>/                   testes unitários da lógica
```

## 1. Registrar a ferramenta

Inclua ou atualize um item na lista `toolsList`, em `configs/tools.js`:

```js
{
  slug: "minha-ferramenta",
  title: "Minha Ferramenta",
  description: "Descrição breve do que a ferramenta faz.",
  icon: "fa-wrench",
  status: TOOL_STATUS.soon,
},
```

Use `TOOL_STATUS.soon` enquanto a ferramenta não estiver pronta. Quando a página estiver implementada e testada, altere para `TOOL_STATUS.available`. O registro deriva automaticamente o endereço (`href`) a partir de `TOOLS_BASE_PATH` e a propriedade `isAvailable`; não duplique esses valores manualmente.

O registro central alimenta o catálogo em `/tools`, o submenu do cabeçalho e os metadados das páginas de ferramentas.

## 2. Criar a página

Crie `pages/tools/<slug>/index.js`:

```js
import ToolPage from "@/components/ToolPage";
import MinhaFerramenta from "@/features/minha-ferramenta/components/MinhaFerramenta";

export default function MinhaFerramentaPage() {
  return (
    <ToolPage slug="minha-ferramenta">
      <MinhaFerramenta />
    </ToolPage>
  );
}
```

O componente `ToolPage` consulta o registro pelo `slug` e fornece o título, a descrição, o ícone, o cabeçalho, o layout e os estilos compartilhados. A página individual deve permanecer fina, delegando a interface à implementação em `features/<slug>/`.

## 3. Implementar a ferramenta

Organize a implementação dentro de `features/<slug>/`:

- `components/`: componentes React específicos da ferramenta, com seus respectivos CSS Modules.
- `lib/`: funções auxiliares e regras que não dependem de React ou do DOM.
- `tests/unit/features/<slug>/`: testes unitários das funções auxiliares.

Sempre que possível, reutilize:

- `@/components/Button` para ações e botões.
- `@/styles/shared.module.css` para classes comuns de formulário, mensagens de erro e caixas informativas.
- `@/components/ToolPage` para manter o padrão visual e estrutural das páginas.
- `@/components/FileDropzone` para o envio de arquivos por clique ou arrastar e soltar.
- `@/components/StatusMessage` para mensagens de andamento, sucesso e erro.
- `@/components/WarningList` para avisos em destaque amarelo com uma lista rolável de itens, usada quando a operação foi concluída, mas com ressalvas.
- `@/components/HelpToggle` para a caixa informativa "Como funciona?".
- `@/lib/files.js` para `getFormattedTimestamp` e `downloadBlob` (download de arquivos gerados no navegador).

Mantenha a lógica independente da interface quando isso facilitar os testes. Bibliotecas que dependem do navegador ou são pesadas devem ser carregadas sob demanda, por `import()`, dentro da função que as utiliza.

Para ferramentas que processam arquivos, avalie executar o processamento no navegador quando isso atender aos requisitos e evitar o envio desnecessário de arquivos ao servidor.

## 4. Testar e disponibilizar

1. Crie testes unitários para as funções de `lib/` em `tests/unit/features/<slug>/`.
2. Execute os testes e as verificações de qualidade do projeto.
3. Confira a rota `/tools/<slug>`, o catálogo e o submenu do cabeçalho.
4. Altere o status para `TOOL_STATUS.available` somente quando a ferramenta estiver pronta para uso.

## Referência: Gerador de QR Code

O Gerador de QR Code demonstra a organização adotada:

- Rota: `pages/tools/qr-code/index.js`.
- Interface: `features/qr-code/components/QrCodeGenerator/`.
- Componentes auxiliares: `ColorField/` e `QrCard/`.
- Lógica auxiliar: `features/qr-code/lib/url.js` e `download.js`.
- Testes: `tests/unit/features/qr-code/lib/`.

A ferramenta valida e normaliza URLs HTTP/HTTPS, permite personalizar as cores do código, do fundo, da borda e do texto, e gera o download de uma imagem PNG. A dependência `html2canvas` é importada dinamicamente, pois a captura do componente depende do DOM do navegador.

## Referência: Divisor de PDF

O Divisor de PDF demonstra uma ferramenta que processa arquivos no navegador:

- Rota: `pages/tools/pdf-splitter/index.js`.
- Interface: `features/pdf-splitter/components/PdfSplitter/`.
- Lógica auxiliar: `features/pdf-splitter/lib/pdf.js`.
- Testes: `tests/unit/features/pdf-splitter/lib/`.

A ferramenta extrai um intervalo de páginas de um ou mais PDFs: com um arquivo, o resultado é um PDF; com vários, um ZIP. Arquivos com menos páginas que o intervalo pedido não geram erro: são extraídos da página inicial até a última e listados em um aviso; arquivos que não chegam à página inicial são ignorados e também listados. Só há erro quando nenhum arquivo tem a página inicial. As bibliotecas `pdf-lib` e `jszip` são importadas dinamicamente. As funções de `lib/pdf.js` retornam objetos `{ ok, ... }` para situações esperadas (intervalo inválido, arquivo que não é PDF, nenhum arquivo com a página inicial), de modo que a interface exiba a mensagem sem depender de exceções.

## Referência: Unificador de PDF

O Unificador de PDF combina dois ou mais arquivos em um único documento:

- Rota: `pages/tools/pdf-merger/index.js`.
- Interface: `features/pdf-merger/components/PdfMerger/`.
- Lógica auxiliar: `features/pdf-merger/lib/pdf.js`.
- Testes: `tests/unit/features/pdf-merger/lib/`.

Os arquivos são ordenados alfabeticamente com comparação numérica natural (por exemplo, `arquivo2.pdf` antes de `arquivo10.pdf`). Por padrão, cada PDF com quantidade ímpar de páginas recebe uma página em branco ao final, usando as dimensões da última página daquele arquivo. A opção pode ser desativada antes da unificação. A dependência `pdf-lib` é importada sob demanda e todo o processamento ocorre no navegador.

## Referência: Gerador de AR e Etiquetas

O Gerador de AR e Etiquetas migra o utilitário legado para a aplicação:

- Rota: `pages/tools/ar-generator/index.js`.
- Interface: `features/ar-generator/components/ArGenerator/`.
- Lógica de PDF: `features/ar-generator/lib/pdf.js`.
- Testes: `tests/unit/features/ar-generator/lib/pdf.test.js`.

A interface mantém cadastros separados para destinatário e remetente. O CEP é consultado pelo ViaCEP e as listas de UFs e municípios são obtidas da API do IBGE. Cada destinatário guarda uma cópia dos dados do remetente no momento da inclusão, para que alterações posteriores não modifiquem registros já cadastrados.

A geração utiliza `pdf-lib` no navegador. O documento mantém dois ARs por página A4 (140 × 94 mm) e etiquetas de 98 × 47 mm, organizadas em duas colunas e quatro linhas. As etiquetas incluem código de barras Code 128 no conjunto C para CEPs numéricos. O logo GIF dos Correios é convertido em PNG no navegador antes de ser incorporado ao PDF.

Como a ferramenta produz material destinado à impressão física, além dos testes automatizados é necessário conferir o PDF em escala real, especialmente alinhamento, margens, legibilidade e compatibilidade com as folhas de etiquetas utilizadas.
