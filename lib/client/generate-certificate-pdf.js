import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  amountToCertificateWords,
  formatCertificateArea,
  formatCertificateCurrency,
  getCertificateDiscountPercentage,
} from "./certificate-format.js";

// A certidão é desenhada diretamente no PDF (texto vetorial, A4), seguindo o
// modelo oficial. As coordenadas abaixo estão em pontos (1/72 polegada),
// medidas a partir do canto superior esquerdo da página, como no modelo.

const PAGE_WIDTH = 595.32;
const PAGE_HEIGHT = 841.92;
const CENTER_X = 298.1;
const BODY_SIZE = 9.96;
const SMALL_SIZE = 8.04;
const MINIMUM_SIZE = 7;

const LOGO_URL = "/brasao_no.jpg";
const TITLE_URL = "/certificates/municipio-de-nova-odessa.png";
const LOGO_BOX = { x: 57.2, top: 15.2, width: 70.5, height: 68.1 };
const TITLE_BOX = { x: 176, top: 12, width: 255, height: 32.1 };

const FRAME = [70.9, 125.4, 525, 534.2];
const REGISTRATION_BOX = [85.1, 150.1, 284.3, 175.8];
const CONTROL_BOX = [311.6, 150.1, 510.8, 175.8];
const OWNER_BOX = [85.1, 199.6, 510.8, 212.9];
const BUYER_BOX = [85.1, 236.6, 510.8, 250];
const BLOCK_BOX = [85.1, 273.7, 284.3, 299.4];
const LOTS_BOX = [311.6, 273.7, 510.8, 299.4];
const LOCATION_BOX = [85.1, 323.2, 510.8, 373.6];
const CERTIFICATION_BOX = [85.1, 385, 510.8, 521.9];

const CERTIFICATION_X = 101.64;
const CERTIFICATION_WIDTH = 392.9;
const CERTIFICATION_FIRST_BASELINE = 395.2;
const CERTIFICATION_MAX_LINES = 7;
const VALUE_BASELINES = [493.65, 505.95, 518.35];

const PARAGRAPH_X = 73.32;
const PARAGRAPH_WIDTH = 449.58;
const OBSERVATION_BASELINE = 549.2;
const DECLARATION_BASELINE = 580.3;
const CLOSING_BASELINE = 654.5;
const CLOSING_LIMIT = 718;
const SIGNATURE_RULE_TOP = 731;

function normalizeText(font, value) {
  const characters = font.getCharacterSet();
  const supported = new Set(characters);
  let result = "";

  for (const character of String(value ?? "").normalize("NFC")) {
    const code = character.codePointAt(0);
    if (supported.has(code)) {
      result += character;
      continue;
    }
    if (/\s/u.test(character)) {
      result += " ";
      continue;
    }
    const base = character.normalize("NFD").replace(/\p{M}/gu, "");
    result +=
      base && [...base].every((item) => supported.has(item.codePointAt(0)))
        ? base
        : "?";
  }

  return result;
}

function saoPauloDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value ? new Date(value) : new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function addDays(parts, days) {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function longDate(parts) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

function formatValidityDate(record) {
  const issued = saoPauloDateParts(record.created_at);
  const days = Math.max(1, Number(record.validity_days) || 30);

  return longDate(addDays(issued, days)).toLocaleUpperCase("pt-BR");
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
}

function formatAmount(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatAddress(record) {
  const number =
    record.property_number == null ? "0" : formatNumber(record.property_number);
  const complement = record.property_complement
    ? " - " + record.property_complement
    : "";
  const address = [
    record.property_street,
    number + complement,
    record.property_neighborhood,
  ]
    .filter(Boolean)
    .join(", ");
  const built = Number(record.built_area ?? 0);

  return (
    address +
    " - Nova Odessa / São Paulo, com área territorial de " +
    formatCertificateArea(record.land_area) +
    " m²" +
    (built > 0
      ? " e área edificada de " + formatCertificateArea(built) + " m²"
      : "")
  );
}

function certificationText(record) {
  const applicant = String(record.applicant_name ?? "").toLocaleUpperCase(
    "pt-BR",
  );
  const purpose = String(record.purpose ?? "").toLocaleUpperCase("pt-BR");
  const protocol =
    record.protocol_number && record.protocol_year
      ? " através do processo administrativo " +
        record.protocol_number +
        "/" +
        record.protocol_year +
        ","
      : "";

  return (
    "Certifico a pedido de " +
    applicant +
    ", para fins de " +
    purpose +
    "," +
    protocol +
    " que revendo os assentamentos destinados a lançamento dos impostos imobiliários, constatei o valor venal relativo ao imóvel acima referenciado, sendo o total de " +
    formatCertificateCurrency(record.total_value) +
    " ( " +
    amountToCertificateWords(record.total_value) +
    "), conforme a PLANTA DE VALORES IMOBILIÁRIOS E TABELA DE PREÇOS CONSTRUÇÕES em vigor para o exercício de " +
    record.year +
    ", compreendendo:"
  );
}

function formatFileTimestamp(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return (
    values.year +
    values.month +
    values.day +
    values.hour +
    values.minute +
    values.second
  );
}

export function createCertificateFileName(records, issuedAt = new Date()) {
  const timestamp = formatFileTimestamp(issuedAt);

  if (records.length === 1) {
    return (
      "cvv-" +
      records[0].physical_property_id +
      "-" +
      records[0].year +
      "-" +
      timestamp +
      ".pdf"
    );
  }

  return "cvv-lote-" + timestamp + ".pdf";
}

// Quebra o texto em linhas de no máximo `maxWidth`. Apenas o espaço comum
// separa palavras; o espaço inseparável (usado em "R$ 1.000,00") não quebra.
export function wrapText(font, text, size, maxWidth) {
  const lines = [];

  for (const paragraph of String(text).split("\n")) {
    const words = paragraph.split(" ").filter(Boolean);
    let current = "";

    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    lines.push(current);
  }

  return lines;
}

function createPainter(page, fonts) {
  const black = rgb(0, 0, 0);
  const toY = (top) => PAGE_HEIGHT - top;

  function rectangle(x0, top0, x1, top1) {
    page.drawRectangle({
      x: x0,
      y: toY(top1),
      width: x1 - x0,
      height: top1 - top0,
      color: black,
    });
  }

  function outline([x0, top0, x1, top1], thickness = 0.95) {
    rectangle(x0, top0, x1, top0 + thickness);
    rectangle(x0, top1 - thickness, x1, top1);
    rectangle(x0, top0, x0 + thickness, top1);
    rectangle(x1 - thickness, top0, x1, top1);
  }

  // O "²" é desenhado como um "2" sobrescrito: alguns leitores de PDF não
  // exibem esse caractere com as fontes padrão. A largura medida continua
  // sendo a do caractere original.
  function text(value, x, baseline, size, font = fonts.regular, options = {}) {
    const parts = normalizeText(font, value).split("\u00b2");
    let cursor = x;

    parts.forEach((part, index) => {
      if (part) {
        page.drawText(part, {
          x: cursor,
          y: toY(baseline),
          size,
          font,
          color: black,
          ...options,
        });
        cursor += font.widthOfTextAtSize(part, size);
      }

      if (index < parts.length - 1) {
        page.drawText("2", {
          x: cursor,
          y: toY(baseline - size * 0.36),
          size: size * 0.6,
          font,
          color: black,
          ...options,
        });
        cursor += font.widthOfTextAtSize("\u00b2", size);
      }
    });
  }

  function measure(value, size, font = fonts.regular) {
    return font.widthOfTextAtSize(normalizeText(font, value), size);
  }

  function centered(value, centerX, baseline, size, font = fonts.regular) {
    text(value, centerX - measure(value, size, font) / 2, baseline, size, font);
  }

  function rightAligned(value, rightX, baseline, size, font = fonts.regular) {
    text(value, rightX - measure(value, size, font), baseline, size, font);
  }

  function fitSize(value, maxWidth, size, font = fonts.regular) {
    let fitted = size;
    while (fitted > MINIMUM_SIZE && measure(value, fitted, font) > maxWidth) {
      fitted -= 0.25;
    }
    return fitted;
  }

  function fittedCentered(value, [x0, , x1], baseline, font = fonts.regular) {
    const size = fitSize(value, x1 - x0 - 12, BODY_SIZE, font);
    centered(value, (x0 + x1) / 2, baseline, size, font);
  }

  function justified(value, x, baseline, width, size, font = fonts.regular) {
    const clean = normalizeText(font, value);
    const words = clean.split(" ").filter(Boolean);
    if (words.length < 2) {
      text(clean, x, baseline, size, font);
      return;
    }
    const wordsWidth = words.reduce(
      (total, word) => total + font.widthOfTextAtSize(word, size),
      0,
    );
    const gap = (width - wordsWidth) / (words.length - 1);
    let cursor = x;
    for (const word of words) {
      text(word, cursor, baseline, size, font);
      cursor += font.widthOfTextAtSize(word, size) + gap;
    }
  }

  // Desenha um parágrafo e devolve a linha de base da última linha.
  function paragraph(value, options) {
    const {
      x,
      width,
      baseline,
      size,
      pitch,
      font = fonts.regular,
      align = "left",
      underline = false,
    } = options;
    const lines = wrapText(font, normalizeText(font, value), size, width);

    lines.forEach((line, index) => {
      const lineBaseline = baseline + index * pitch;
      const isLast = index === lines.length - 1;
      const lineWidth = font.widthOfTextAtSize(line, size);

      if (align === "justify" && !isLast) {
        justified(line, x, lineBaseline, width, size, font);
      } else if (align === "center") {
        const lineX = x + (width - lineWidth) / 2;
        text(line, lineX, lineBaseline, size, font);
        if (underline) {
          rectangle(
            lineX,
            lineBaseline + 1.1,
            lineX + lineWidth,
            lineBaseline + 2.2,
          );
        }
      } else {
        text(line, x, lineBaseline, size, font);
      }
    });

    return baseline + (lines.length - 1) * pitch;
  }

  return {
    fonts,
    black,
    toY,
    rectangle,
    outline,
    text,
    measure,
    centered,
    rightAligned,
    fitSize,
    fittedCentered,
    paragraph,
  };
}

function drawStaticStructure(page, painter, images) {
  const { centered, rectangle, outline, text, measure } = painter;
  const bold = painter.fonts.bold;

  if (images.logo) {
    page.drawImage(images.logo, {
      x: LOGO_BOX.x,
      y: painter.toY(LOGO_BOX.top + LOGO_BOX.height),
      width: LOGO_BOX.width,
      height: LOGO_BOX.height,
    });
  }

  if (images.title) {
    page.drawImage(images.title, {
      x: TITLE_BOX.x,
      y: painter.toY(TITLE_BOX.top + TITLE_BOX.height),
      width: TITLE_BOX.width,
      height: TITLE_BOX.height,
    });
  }

  rectangle(179.5, 44.2, 426.7, 45.5);
  rectangle(179.5, 46.8, 426.7, 48.1);

  centered("Secretaria de Finanças", 305.47, 68, 12, bold);

  const title = "CERTIDÃO DE VALOR VENAL";
  const titleWidth = measure(title, 15.96, bold);
  const titleX = CENTER_X - (titleWidth + 4.4) / 2;
  text(title, titleX, 102.8, 15.96, bold);
  rectangle(titleX, 104.5, titleX + titleWidth + 4.4, 106.2);

  outline(FRAME, 1);
  [
    REGISTRATION_BOX,
    CONTROL_BOX,
    OWNER_BOX,
    BUYER_BOX,
    BLOCK_BOX,
    LOTS_BOX,
    LOCATION_BOX,
    CERTIFICATION_BOX,
  ].forEach((box) => outline(box));

  centered("Número do cadastro", 184.7, 147.5, BODY_SIZE);
  centered("Controle", 411.2, 147.5, BODY_SIZE);
  centered("Proprietário", 298.4, 196.9, BODY_SIZE);
  centered("Compromissário", 298.1, 234, BODY_SIZE);
  centered("Quadra", 184.7, 271.1, BODY_SIZE);
  centered("Lote", 411.2, 271.1, BODY_SIZE);
  centered("Localização", 298.45, 320.5, BODY_SIZE);

  rectangle(170.5, 496.2, 383, 497.2);
  rectangle(170.5, 508.6, 383, 509.5);
  rectangle(241.3, SIGNATURE_RULE_TOP, 354.7, SIGNATURE_RULE_TOP + 1);
  rectangle(57.2, 767.2, 524.6, 770);

  text(
    "ESTA CERTIDÃO SÓ É VÁLIDA SE ESTIVER ASSINADA.",
    184.92,
    778.1,
    SMALL_SIZE,
  );
  centered(
    "Av. João Pessoa, 777 – Centro / Nova Odessa – SP",
    297.8,
    791.5,
    BODY_SIZE,
  );
  centered(
    "www.novaodessa.sp.gov.br – tributo@novaodessa.sp.gov.br",
    297.8,
    803.9,
    BODY_SIZE,
  );
  centered("Fone: (19) 3476-8600", 297.8, 816.2, BODY_SIZE);
}

function drawCertificate(page, fonts, images, record) {
  const painter = createPainter(page, fonts);
  const { text, measure, centered, rightAligned, fittedCentered, rectangle } =
    painter;
  const { bold, regular } = fonts;

  drawStaticStructure(page, painter, images);

  const exercise = "EXERCÍCIO DE " + record.year;
  centered(exercise, CENTER_X, 122.6, 15.96, bold);
  const exerciseWidth = measure(exercise, 15.96, bold);
  rectangle(
    CENTER_X - exerciseWidth / 2,
    124.3,
    CENTER_X + exerciseWidth / 2,
    125.9,
  );

  // Texto lateral, na vertical, com sublinhado.
  const validity =
    "ESTA CERTIDÃO SÓ É VÁLIDA ATÉ " + formatValidityDate(record) + ".";
  text(validity, 60.12, 517.1, BODY_SIZE, bold, { rotate: degrees(90) });
  rectangle(61.3, 517.1 - measure(validity, BODY_SIZE, bold), 62.4, 517.1);

  fittedCentered(
    record.physical_registration || "-",
    REGISTRATION_BOX,
    166.1,
    bold,
  );
  fittedCentered(
    Number(record.physical_property_id ?? 0).toLocaleString("pt-BR"),
    CONTROL_BOX,
    166.1,
    bold,
  );
  fittedCentered(record.owner_name || "-", OWNER_BOX, 209.3);
  fittedCentered(record.promissory_buyer || "-", BUYER_BOX, 246.6);
  fittedCentered(record.property_block || "-", BLOCK_BOX, 289.7, bold);
  fittedCentered(record.property_lots || "-", LOTS_BOX, 289.7, bold);

  // Localização: bloco centralizado verticalmente na caixa.
  const locationLines = wrapText(
    bold,
    normalizeText(bold, formatAddress(record)),
    BODY_SIZE,
    410,
  );
  const locationPitch = 12.9;
  const locationCenter = (LOCATION_BOX[1] + LOCATION_BOX[3]) / 2 + 3.15;
  locationLines.forEach((line, index) => {
    centered(
      line,
      CENTER_X,
      locationCenter + (index - (locationLines.length - 1) / 2) * locationPitch,
      BODY_SIZE,
      bold,
    );
  });

  // Texto da certidão: reduz a fonte se passar de sete linhas.
  let certificationSize = BODY_SIZE;
  const certification = normalizeText(regular, certificationText(record));
  while (
    certificationSize > 8 &&
    wrapText(regular, certification, certificationSize, CERTIFICATION_WIDTH)
      .length > CERTIFICATION_MAX_LINES
  ) {
    certificationSize -= 0.25;
  }
  painter.paragraph(certification, {
    x: CERTIFICATION_X,
    width: CERTIFICATION_WIDTH,
    baseline: CERTIFICATION_FIRST_BASELINE,
    size: certificationSize,
    pitch: (certificationSize / BODY_SIZE) * 12.35,
    align: "justify",
  });

  // Valores.
  const buildingValue = Number(record.building_value ?? 0);
  const rows = [
    ["TERRENO:", formatAmount(record.land_value)],
    ["CONSTRUÇÃO:", buildingValue === 0 ? "-" : formatAmount(buildingValue)],
    ["SOMA TOTAL:", formatAmount(record.total_value)],
  ];
  rows.forEach(([label, amount], index) => {
    const baseline = VALUE_BASELINES[index];
    rightAligned(label, 250.8, baseline, BODY_SIZE);
    text("R$", 260.76, baseline, BODY_SIZE, bold);
    rightAligned(
      amount,
      amount === "-" ? 366.6 : 377.63,
      baseline,
      BODY_SIZE,
      bold,
    );
  });

  // Blocos abaixo da moldura: observação do formulário, declaração do R.G. e
  // observação do desconto. Se o texto crescer, o restante desce junto e, se
  // ainda assim não couber antes da assinatura, a observação diminui.
  const hasRg = Boolean(String(record.owner_rg ?? "").trim());
  const discount = hasRg ? getCertificateDiscountPercentage(record) : 0;
  const observation = String(record.observations ?? "").trim();
  const declaration = hasRg
    ? normalizeText(
        regular,
        String(record.applicant_name ?? "") +
          ", portador(a) do R.G. " +
          String(record.owner_rg).trim() +
          ", declaro para os devidos fins e sob as penas da lei nº\u00a01225/1990, que possuo um único imóvel nesse município.",
      )
    : "";
  const discountText = discount
    ? normalizeText(
        bold,
        "OBS.: Esta CERTIDÃO foi expedida com " +
          discount +
          "% desconto de acordo com a lei Municipal n° 1225 de 03 de Dezembro de 1990.",
      )
    : "";
  const observationText = observation
    ? normalizeText(regular, "Observação: " + observation)
    : "";

  function layoutBlocks(observationSize) {
    const observationLines = observationText
      ? wrapText(regular, observationText, observationSize, PARAGRAPH_WIDTH)
      : [];
    const pitch = (observationSize / BODY_SIZE) * 12.4;
    const firstObservation =
      OBSERVATION_BASELINE - ((observationLines.length - 1) * pitch) / 2;
    const lastObservation =
      firstObservation + (observationLines.length - 1) * pitch;
    const declarationBaseline = observationLines.length
      ? Math.max(DECLARATION_BASELINE, lastObservation + 22)
      : DECLARATION_BASELINE;
    const declarationLines = declaration
      ? wrapText(regular, declaration, BODY_SIZE, PARAGRAPH_WIDTH)
      : [];
    const lastDeclaration =
      declarationBaseline + Math.max(0, declarationLines.length - 1) * 12.4;
    const discountBaseline = lastDeclaration + 24.3;
    const discountLines = discountText
      ? wrapText(bold, discountText, BODY_SIZE, PARAGRAPH_WIDTH)
      : [];
    const lastDiscount =
      discountBaseline + Math.max(0, discountLines.length - 1) * 12.9;
    const lastBaseline = discountLines.length
      ? lastDiscount
      : declarationLines.length
        ? lastDeclaration
        : observationLines.length
          ? lastObservation
          : 0;

    return {
      observationLines,
      pitch,
      firstObservation,
      declarationBaseline,
      discountBaseline,
      closingBaseline: Math.max(CLOSING_BASELINE, lastBaseline + 24.6),
    };
  }

  let observationSize = BODY_SIZE;
  let layout = layoutBlocks(observationSize);
  while (
    observationSize > MINIMUM_SIZE &&
    layout.closingBaseline > CLOSING_LIMIT
  ) {
    observationSize -= 0.25;
    layout = layoutBlocks(observationSize);
  }

  layout.observationLines.forEach((line, index) => {
    centered(
      line,
      CENTER_X,
      layout.firstObservation + index * layout.pitch,
      observationSize,
    );
  });

  if (declaration) {
    painter.paragraph(declaration, {
      x: PARAGRAPH_X,
      width: PARAGRAPH_WIDTH,
      baseline: layout.declarationBaseline,
      size: BODY_SIZE,
      pitch: 12.4,
      align: "justify",
    });
  }

  if (discountText) {
    painter.paragraph(discountText, {
      x: PARAGRAPH_X,
      width: PARAGRAPH_WIDTH,
      baseline: layout.discountBaseline,
      size: BODY_SIZE,
      pitch: 12.9,
      font: bold,
      align: "center",
      underline: true,
    });
  }

  // Fecho, data e assinatura.
  const closingBaseline = Math.min(layout.closingBaseline, CLOSING_LIMIT);
  text(
    "O referido é verdade e dou fé.",
    PARAGRAPH_X,
    closingBaseline,
    BODY_SIZE,
  );
  text(
    "Nova Odessa, " + longDate(saoPauloDateParts(record.created_at)),
    PARAGRAPH_X,
    closingBaseline + 12.1,
    BODY_SIZE,
  );

  centered(record.issuer_name || "Não informado", 298.04, 741, SMALL_SIZE);
  centered(
    record.issuer_position || "Não informado",
    298.04,
    751.8,
    SMALL_SIZE,
  );

  if (record.id) {
    rightAligned("ID: " + record.id, 524.6, 829.2, 5.2, regular);
  }
}

async function embedOptionalImage(pdf, bytes, kind) {
  if (!bytes) return null;
  return kind === "jpg" ? pdf.embedJpg(bytes) : pdf.embedPng(bytes);
}

// Gera os bytes do PDF (uma página A4 por certidão). Recebe os bytes do
// brasão (JPEG) e do título "Município de Nova Odessa" (PNG).
export async function buildCertificatePdf(records, assets = {}) {
  if (!Array.isArray(records) || !records.length) {
    throw new Error("Selecione ao menos uma certidão para gerar o PDF.");
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle("Certidão de Valor Venal");
  pdf.setCreator("utilities-node");
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const images = {
    logo: await embedOptionalImage(pdf, assets.logo, "jpg"),
    title: await embedOptionalImage(pdf, assets.title, "png"),
  };

  for (const record of records) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawCertificate(page, fonts, images, record);
  }

  return await pdf.save();
}

async function fetchAsset(url, errorMessage) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(errorMessage);
  return new Uint8Array(await response.arrayBuffer());
}

export async function downloadCertificatePdf(records) {
  if (!Array.isArray(records) || !records.length) {
    throw new Error("Selecione ao menos uma certidão para gerar o PDF.");
  }

  const [logo, title] = await Promise.all([
    fetchAsset(LOGO_URL, "Não foi possível carregar o brasão da Prefeitura."),
    fetchAsset(TITLE_URL, "Não foi possível carregar o cabeçalho da certidão."),
  ]);
  const bytes = await buildCertificatePdf(records, { logo, title });

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = createCertificateFileName(records);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
