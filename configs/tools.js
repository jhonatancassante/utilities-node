// configs/tools.js
// Registro central das ferramentas. Alimenta o menu superior, a página
// inicial e o título/descrição de cada página de ferramenta. Para adicionar
// uma nova ferramenta: inclua um item aqui e crie `pages/tools/<slug>/index.js`.

export const TOOL_STATUS = Object.freeze({
  available: "available",
  soon: "soon",
});

const toolsList = [
  {
    slug: "qr-code",
    title: "Gerador de QR Code",
    description:
      "Gere QR Codes personalizados a partir de um link, com cores e download em imagem.",
    icon: "fa-qrcode",
    status: TOOL_STATUS.available,
  },
  {
    slug: "pdf-splitter",
    title: "Divisor de PDF",
    description:
      "Extraia intervalos de páginas de um ou mais PDFs, direto no navegador.",
    icon: "fa-file-pdf",
    status: TOOL_STATUS.available,
  },
  {
    slug: "pdf-merger",
    title: "Unificador de PDF",
    description:
      "Una vários arquivos PDF em um único documento, direto no navegador.",
    icon: "fa-object-group",
    status: TOOL_STATUS.available,
  },
  {
    slug: "csv-para-json",
    title: "Conversor de CSV para JSON",
    description:
      "Converta arquivos CSV em JSON, ajustando a codificação, o delimitador, o cabeçalho e as colunas.",
    icon: "fa-file-csv",
    status: TOOL_STATUS.available,
  },
  {
    slug: "json-para-csv",
    title: "Conversor de JSON para CSV",
    description:
      "Converta arquivos JSON em CSV, selecionando colunas, delimitador e codificação de saída.",
    icon: "fa-file-code",
    status: TOOL_STATUS.available,
  },
  {
    slug: "txt-para-csv",
    title: "Conversor de TXT para CSV",
    description: "Transforme arquivos de texto em planilhas CSV.",
    icon: "fa-file-alt",
    status: TOOL_STATUS.soon,
  },
  {
    slug: "testador-cpf",
    title: "Testador de CPF",
    description: "Valide se um número de CPF é válido.",
    icon: "fa-id-card",
    status: TOOL_STATUS.soon,
  },
  {
    slug: "ar-generator",
    title: "Gerador de AR",
    description:
      "Gere avisos de recebimento e etiquetas de endereçamento para correspondências.",
    icon: "fa-envelope-open-text",
    status: TOOL_STATUS.available,
  },
];

export const TOOLS_BASE_PATH = "/tools";

export const tools = Object.freeze(
  toolsList.map((tool) =>
    Object.freeze({
      ...tool,
      href: `${TOOLS_BASE_PATH}/${tool.slug}`,
      isAvailable: tool.status === TOOL_STATUS.available,
    }),
  ),
);

export function getToolBySlug(slug) {
  return tools.find((tool) => tool.slug === slug);
}
