import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import {
  amountToPortugueseWords,
  formatCertificateArea,
  formatCertificateCurrency,
  getCertificateDiscountPercentage,
} from "./certificate-format.js";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PDF_WIDTH = 595.32;
const PDF_HEIGHT = 841.92;

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
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
    amountToPortugueseWords(record.total_value) +
    " ), conforme a PLANTA DE VALORES IMOBILIÁRIOS E TABELA DE PREÇOS CONSTRUÇÕES em vigor para o exercício de " +
    record.year +
    ", compreendendo:"
  );
}

function markup(record) {
  const discount = getCertificateDiscountPercentage(record);
  const hasRg = Boolean(String(record.owner_rg ?? "").trim());
  const observation = String(record.observations ?? "").trim();
  const declaration = hasRg
    ? String(record.applicant_name ?? "") +
      ", portador(a) do R.G. " +
      String(record.owner_rg).trim() +
      ", declaro para os devidos fins e sob as penas da lei nº 1225/1990, que possuo um único imóvel nesse município."
    : "";
  const discountText = discount
    ? "OBS.: Esta CERTIDÃO foi expedida com " +
      discount +
      "% desconto de acordo com a lei Municipal n° 1225 de 03 de Dezembro de 1990."
    : "";
  const issueDate = longDate(saoPauloDateParts(record.created_at));
  const styles = [
    "*{box-sizing:border-box}",
    ".certificate{position:relative;width:794px;height:1123px;background:#fff;color:#000;font-family:'Times New Roman',Times,serif;font-size:13px;overflow:hidden}",
    ".logo{position:absolute;left:48px;top:25px;width:62px;height:68px;object-fit:contain}",
    ".municipality{position:absolute;left:180px;top:25px;width:450px;text-align:center;font-size:22px;font-weight:bold;font-style:italic;text-decoration:underline}",
    ".secretariat{position:absolute;left:180px;top:77px;width:450px;text-align:center;font-size:13px;font-weight:bold}",
    ".title{position:absolute;left:95px;top:119px;width:605px;text-align:center;font-size:14px;font-weight:bold;text-decoration:underline;line-height:17px}",
    ".year{position:absolute;left:95px;top:146px;width:605px;text-align:center;font-size:14px;font-weight:bold;text-decoration:underline}",
    ".validity{position:absolute;left:69px;top:706px;width:520px;height:15px;transform:rotate(-90deg);transform-origin:top left;white-space:nowrap;text-align:center;font-size:10px;font-weight:bold}",
    ".frame{position:absolute;left:95px;top:167px;width:605px;height:546px;border:1px solid #222}",
    ".label{position:absolute;text-align:center;font-size:10px;line-height:13px}",
    ".box{position:absolute;border:1px solid #333;height:34px;display:flex;align-items:center;justify-content:center;text-align:center;padding:2px 5px;font-size:12px;line-height:14px}",
    ".registration-label{left:115px;top:185px;width:264px}.control-label{left:417px;top:185px;width:264px}",
    ".registration-box{left:115px;top:200px;width:264px;white-space:nowrap;overflow:hidden}.control-box{left:417px;top:200px;width:264px}",
    ".owner-label{left:250px;top:252px;width:310px}.owner{position:absolute;left:170px;top:268px;width:470px;text-align:center;font-size:12px;line-height:15px;white-space:nowrap;overflow:hidden}",
    ".buyer-label{left:250px;top:302px;width:310px}.buyer{position:absolute;left:170px;top:318px;width:470px;text-align:center;font-size:12px;line-height:15px;white-space:nowrap;overflow:hidden}",
    ".block-label{left:115px;top:351px;width:264px}.lots-label{left:417px;top:351px;width:264px}",
    ".block-box{left:115px;top:365px;width:264px}.lots-box{left:417px;top:365px;width:264px}",
    ".location-label{left:115px;top:417px;width:566px}",
    ".location{position:absolute;left:115px;top:431px;width:566px;height:67px;border:1px solid #333;display:flex;align-items:center;justify-content:center;text-align:center;padding:5px 10px;font-size:12px;line-height:15px}",
    ".certification{position:absolute;left:135px;top:513px;width:530px;font-size:12px;line-height:16px;text-align:justify}",
    ".values{position:absolute;left:227px;top:644px;width:284px;font-size:12px;line-height:16.5px}.value-row{display:grid;grid-template-columns:125px 31px 1fr;align-items:center;height:16.5px}",
    ".value-label{text-align:right;padding-right:8px}.value-currency{text-align:center}.value-amount{text-align:right}",
    ".real{position:absolute;left:650px;top:682px;width:40px;font-size:11px}.separator{position:absolute;left:525px;top:696px;width:165px;text-align:center;font-size:12px;letter-spacing:4px}",
    ".optional{position:absolute;left:122px;top:713px;width:570px;font-size:12px;line-height:16px}.optional p{margin:0 0 15px;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".optional .discount{text-align:center;font-weight:bold;text-decoration:underline;margin-bottom:0}",
    ".closing{position:absolute;left:98px;top:862px;font-size:12px;line-height:16px}.issue-date{position:absolute;left:98px;top:879px;font-size:12px;line-height:16px}",
    ".signature{position:absolute;left:322px;top:974px;width:151px;border-top:1px solid #222}.signer{position:absolute;left:245px;top:979px;width:305px;text-align:center;font-size:12px;line-height:14px}.position{position:absolute;left:245px;top:994px;width:305px;text-align:center;font-size:11px;line-height:13px}",
    ".footer-rule{position:absolute;left:76px;top:1023px;width:623px;border-top:3px solid #222}.footer-notice{position:absolute;left:76px;top:1028px;width:623px;text-align:center;font-size:10px;font-weight:bold}",
    ".footer-address{position:absolute;left:76px;top:1044px;width:623px;text-align:center;font-size:10px;line-height:14px}.footer-contact{position:absolute;left:76px;top:1060px;width:623px;text-align:center;font-size:10px;line-height:14px}.footer-phone{position:absolute;left:76px;top:1076px;width:623px;text-align:center;font-size:10px;line-height:14px}",
  ].join("");
  const observationHtml = observation
    ? '<p class="form-observation">Observação: ' +
      escapeHtml(observation) +
      "</p>"
    : "";
  const declarationHtml = declaration
    ? '<p class="declaration">' + escapeHtml(declaration) + "</p>"
    : "";
  const discountHtml = discountText
    ? '<p class="discount">' + escapeHtml(discountText) + "</p>"
    : "";
  const building =
    Number(record.building_value ?? 0) === 0
      ? "—"
      : escapeHtml(formatCertificateCurrency(record.building_value));
  return (
    '<div class="certificate"><style>' +
    styles +
    "</style>" +
    '<img class="logo" src="/brasao_no.jpg" alt="Brasão do Município de Nova Odessa">' +
    '<div class="municipality">Município de Nova Odessa</div><div class="secretariat">Secretaria de Finanças</div>' +
    '<div class="title">CERTIDÃO DE VALOR VENAL</div><div class="year">EXERCÍCIO DE ' +
    escapeHtml(record.year) +
    "</div>" +
    '<div class="validity">ESTA CERTIDÃO SÓ É VÁLIDA ATÉ ' +
    escapeHtml(formatValidityDate(record)) +
    ".</div>" +
    '<div class="frame"></div><div class="label registration-label">Número do cadastro</div><div class="label control-label">Controle</div>' +
    '<div class="box registration-box">' +
    escapeHtml(record.physical_registration || "—") +
    "</div>" +
    '<div class="box control-box">' +
    escapeHtml(
      Number(record.physical_property_id ?? 0).toLocaleString("pt-BR"),
    ) +
    "</div>" +
    '<div class="label owner-label">Proprietário</div><div class="owner">' +
    escapeHtml(record.owner_name || "—") +
    "</div>" +
    '<div class="label buyer-label">Compromissário</div><div class="buyer">' +
    escapeHtml(record.promissory_buyer || "—") +
    "</div>" +
    '<div class="label block-label">Quadra</div><div class="label lots-label">Lote</div>' +
    '<div class="box block-box">' +
    escapeHtml(record.property_block || "—") +
    "</div>" +
    '<div class="box lots-box">' +
    escapeHtml(record.property_lots || "—") +
    "</div>" +
    '<div class="label location-label">Localização</div><div class="location">' +
    escapeHtml(formatAddress(record)) +
    "</div>" +
    '<div class="certification">' +
    escapeHtml(certificationText(record)) +
    "</div>" +
    '<div class="values"><div class="value-row"><span class="value-label">TERRENO:</span><span class="value-currency">R$</span><span class="value-amount">' +
    escapeHtml(formatCertificateCurrency(record.land_value)) +
    "</span></div>" +
    '<div class="value-row"><span class="value-label">CONSTRUÇÃO:</span><span class="value-currency">R$</span><span class="value-amount">' +
    building +
    "</span></div>" +
    '<div class="value-row"><span class="value-label">SOMA TOTAL:</span><span class="value-currency">R$</span><span class="value-amount">' +
    escapeHtml(formatCertificateCurrency(record.total_value)) +
    "</span></div></div>" +
    '<div class="real">Real</div><div class="separator"># # #</div>' +
    '<div class="optional">' +
    observationHtml +
    declarationHtml +
    discountHtml +
    "</div>" +
    '<div class="closing">O referido é verdade e dou fé.</div><div class="issue-date">Nova Odessa, ' +
    escapeHtml(issueDate) +
    "</div>" +
    '<div class="signature"></div><div class="signer">' +
    escapeHtml(record.issuer_name || "Não informado") +
    "</div>" +
    '<div class="position">' +
    escapeHtml(record.issuer_position || "Não informado") +
    "</div>" +
    '<div class="footer-rule"></div><div class="footer-notice">ESTA CERTIDÃO SÓ É VÁLIDA SE ESTIVER ASSINADA.</div>' +
    '<div class="footer-address">Av. João Pessoa, 777 – Centro / Nova Odessa – SP</div>' +
    '<div class="footer-contact">www.novaodessa.sp.gov.br – tributo@novaodessa.sp.gov.br</div>' +
    '<div class="footer-phone">Fone: (19) 3476-8600</div></div>'
  );
}

function fileName(records) {
  if (records.length === 1) {
    return (
      "certidao-valor-venal-" +
      records[0].physical_property_id +
      "-" +
      records[0].year +
      ".pdf"
    );
  }
  return (
    "certidoes-valor-venal-" + new Date().toISOString().slice(0, 10) + ".pdf"
  );
}

export async function downloadCertificatePdf(records) {
  if (!Array.isArray(records) || !records.length) {
    throw new Error("Selecione ao menos uma certidão para gerar o PDF.");
  }
  const pdf = await PDFDocument.create();
  const container = document.createElement("div");
  container.dataset.certificatePdfContainer = "true";
  Object.assign(container.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: PAGE_WIDTH + "px",
    height: PAGE_HEIGHT + "px",
    opacity: "0",
    zIndex: "-1",
    pointerEvents: "none",
  });
  document.body.appendChild(container);
  try {
    for (const record of records) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = markup(record);
      const element = wrapper.firstElementChild;
      container.appendChild(element);
      const logo = element.querySelector(".logo");
      if (logo && !logo.complete) {
        await new Promise((resolve, reject) => {
          logo.onload = resolve;
          logo.onerror = () =>
            reject(
              new Error("Não foi possível carregar o brasão da Prefeitura."),
            );
        });
      }
      if (logo && typeof logo.decode === "function") await logo.decode();
      const fitSingleLine = (selector, minimumSize = 9) => {
        const target = element.querySelector(selector);
        if (!target) return;
        let fontSize = 12;
        target.style.fontSize = fontSize + "px";
        while (
          target.scrollWidth > target.clientWidth + 1 &&
          fontSize > minimumSize
        ) {
          fontSize -= 0.5;
          target.style.fontSize = fontSize + "px";
        }
      };
      fitSingleLine(".owner");
      fitSingleLine(".buyer");
      fitSingleLine(".registration-box");
      const certification = element.querySelector(".certification");
      let certificationSize = 12;
      while (certification.scrollHeight > 124 && certificationSize > 10) {
        certificationSize -= 0.5;
        certification.style.fontSize = certificationSize + "px";
        certification.style.lineHeight = certificationSize * 1.3 + "px";
      }
      const location = element.querySelector(".location");
      let locationSize = 12;
      while (location.scrollHeight > 58 && locationSize > 10) {
        locationSize -= 0.5;
        location.style.fontSize = locationSize + "px";
        location.style.lineHeight = locationSize * 1.25 + "px";
      }
      const optional = element.querySelector(".optional");
      const closing = element.querySelector(".closing");
      const issueDate = element.querySelector(".issue-date");
      const bottom =
        optional.getBoundingClientRect().bottom -
        element.getBoundingClientRect().top;
      const closingTop = Math.max(862, bottom + 32);
      closing.style.top = closingTop + "px";
      issueDate.style.top = closingTop + 17 + "px";
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: 3,
        useCORS: true,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        windowWidth: PAGE_WIDTH,
        windowHeight: PAGE_HEIGHT,
        onclone: (clonedDocument) => {
          const clonedContainer = clonedDocument.querySelector(
            '[data-certificate-pdf-container="true"]',
          );
          if (clonedContainer) {
            clonedContainer.style.opacity = "1";
            clonedContainer.style.zIndex = "1";
          }
        },
      });
      const imageBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(
                  new Error("Não foi possível converter a certidão em imagem."),
                ),
          "image/png",
        );
      });
      const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
      const image = await pdf.embedPng(imageBytes);
      const page = pdf.addPage([PDF_WIDTH, PDF_HEIGHT]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: PDF_WIDTH,
        height: PDF_HEIGHT,
      });
      element.remove();
    }
    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName(records);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    container.remove();
  }
}
