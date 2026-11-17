// configs/tools.js
// Registro central das ferramentas. Alimenta o menu superior, a página
// inicial e o título/descrição de cada página de ferramenta. Para adicionar
// uma nova ferramenta: inclua um item aqui e crie `pages/ferramentas/<slug>.js`.

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
    slug: "divisor-pdf",
    title: "Divisor de PDF",
    description: "Separe as páginas de um PDF em arquivos individuais.",
    icon: "fa-file-pdf",
    status: TOOL_STATUS.soon,
  },
  {
    slug: "unificador-pdf",
    title: "Unificador de PDF",
    description: "Junte vários arquivos PDF em um único documento.",
    icon: "fa-layer-group",
    status: TOOL_STATUS.soon,
  },
  {
    slug: "csv-para-json",
    title: "Conversor de CSV para JSON",
    description: "Converta planilhas CSV em arquivos JSON.",
    icon: "fa-file-csv",
    status: TOOL_STATUS.soon,
  },
  {
    slug: "json-para-csv",
    title: "Conversor de JSON para CSV",
    description: "Converta arquivos JSON em planilhas CSV.",
    icon: "fa-file-code",
    status: TOOL_STATUS.soon,
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
    slug: "gerador-ar",
    title: "Gerador de AR",
    description:
      "Gere o aviso de recebimento (confirmação de recebimento) dos Correios.",
    icon: "fa-envelope-open-text",
    status: TOOL_STATUS.soon,
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
