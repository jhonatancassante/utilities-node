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
    slug: "csv-to-json",
    title: "Conversor de CSV para JSON",
    description:
      "Converta arquivos CSV em JSON, ajustando a codificação, o delimitador, o cabeçalho e as colunas.",
    icon: "fa-file-csv",
    status: TOOL_STATUS.available,
  },
  {
    slug: "json-to-csv",
    title: "Conversor de JSON para CSV",
    description:
      "Converta arquivos JSON em CSV, selecionando colunas, delimitador e codificação de saída.",
    icon: "fa-file-code",
    status: TOOL_STATUS.available,
  },
  {
    slug: "txt-to-csv",
    title: "Conversor de TXT para CSV",
    description:
      "Converta relatórios TXT de largura fixa em CSV, ajustando o separador e a formatação de datas e números.",
    icon: "fa-file-alt",
    status: TOOL_STATUS.available,
  },
  {
    slug: "cpf-tester",
    title: "Testador de CPF",
    description:
      "Valide CPFs, calcule os dígitos verificadores e encontre variações válidas com a troca de um único dígito.",
    icon: "fa-id-card",
    status: TOOL_STATUS.available,
  },
  {
    slug: "ar-generator",
    title: "Gerador de AR",
    description:
      "Gere avisos de recebimento e etiquetas de endereçamento para correspondências.",
    icon: "fa-envelope-open-text",
    status: TOOL_STATUS.available,
  },
  {
    slug: "certificates",
    title: "Certidões",
    description: "Consulte e emita certidões de valor venal.",
    icon: "fa-file-alt",
    status: TOOL_STATUS.available,
    requiredFeature: "read:certificate",
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
