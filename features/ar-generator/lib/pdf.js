// features/ar-generator/lib/pdf.js
// Gera os documentos no navegador. A geometria é definida em milímetros
// para preservar o posicionamento do gerador legado.
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { getFormattedTimestamp } from "@/lib/files.js";

const MM = 72 / 25.4;
const pageW = 210;
const pageH = 297;
const mm = (value) => value * MM;
const yTop = (value) => mm(pageH - value);

// prettier-ignore
function text(page, value, x, y, size, font, color = rgb(0, 0, 0)) {
  if (!value) return;
  page.drawText(String(value), {
    x: mm(x),
    y: yTop(y) - size * 0.82,
    size,
    font,
    color,
  });
}

// prettier-ignore
function line(page, x1, y1, x2, y2, width = 0.35, dashArray) {
  const options = {
    start: { x: mm(x1), y: yTop(y1) },
    end: { x: mm(x2), y: yTop(y2) },
    thickness: mm(width),
    color: rgb(0, 0, 0),
  };
  if (dashArray) options.dashArray = dashArray.map(mm);
  page.drawLine(options);
}

// Desenha um retângulo tracejado, como no formulário original dos Correios.
function dashedRect(page, x, y, width, height, lineWidth = 0.2) {
  line(page, x, y, x + width, y, lineWidth, [0.3, 0.5]);
  line(page, x + width, y, x + width, y + height, lineWidth, [0.3, 0.5]);
  line(page, x + width, y + height, x, y + height, lineWidth, [0.3, 0.5]);
  line(page, x, y + height, x, y, lineWidth, [0.3, 0.5]);
}

function verticalText(page, value, x, y, size, font) {
  page.drawText(value, {
    x: mm(x),
    y: yTop(y) - size * 0.82,
    size,
    font,
    rotate: degrees(90),
  });
}

// prettier-ignore
function rect(page, x, y, w, h, width = 0.35) {
  page.drawRectangle({
    x: mm(x),
    y: yTop(y + h),
    width: mm(w),
    height: mm(h),
    borderWidth: mm(width),
    borderColor: rgb(0, 0, 0),
  });
}

// prettier-ignore
function fit(page, value, x, y, maxWidth, size, font) {
  let current = size;
  const label = String(value ?? "");
  while (current > 4.5 && font.widthOfTextAtSize(label, current) > mm(maxWidth)) current -= 0.25;
  text(page, label, x, y, current, font);
}

// prettier-ignore
function drawAR(page, x, y, data, fonts, logo) {
  const { regular, bold } = fonts;
  const sender = data.remetente;
  rect(page, x, y, 140, 94);
  line(page, x + 8, y, x + 8, y + 94);
  line(page, x + 7, y, x + 7, y + 94, 0.2, [0.3, 0.5]);
  verticalText(page, "(ÁREA DE COLA NO VERSO)", x + 5, y + 65, 6, regular);
  const right = x + 106;
  line(page, right, y, right, y + 52);
  line(page, right, y + 59, right, y + 94);
  line(page, x + 8, y + 8, x + 140, y + 8);
  if (logo) page.drawImage(logo, { x: mm(x + 9.5), y: yTop(y + 6.7), width: mm(28), height: mm(5.5) });
  else text(page, "Correios", x + 10, y + 5.5, 9, bold);
  text(page, "AVISO DE RECEBIMENTO", x + 41, y + 5, 9, bold);
  text(page, "AR", x + 85, y + 6, 15, bold);
  text(page, "DATA DE POSTAGEM", right + 0.7, y + 2.5, 6, bold);
  line(page, x + 8, y + 52, x + 140, y + 52);
  text(page, "DESTINATÁRIO", x + 10, y + 11.5, 6, bold);
  let yy = y + 14;
  fit(page, data.nome.toUpperCase(), x + 10, yy, 94, 6, regular);
  yy += 2.5;
  text(page, `${data.endereco.toUpperCase()}, ${data.numero}`, x + 10, yy, 6, regular);
  yy += 2.5;
  if (data.complemento) { text(page, data.complemento.toUpperCase(), x + 10, yy, 6, regular); yy += 2.5; }
  text(page, data.bairro.toUpperCase(), x + 10, yy, 6, regular);
  yy += 2.5;
  text(page, `${data.cep} - ${data.cidade.toUpperCase()} - ${data.uf}`, x + 10, yy, 6, regular);
  dashedRect(page, x + 28, y + 30, 52, 3.5);
  text(page, "(CÓDIGO DE BARRAS OU Nº DE REGISTRO DO OBJETO)", x + 30, y + 32.5, 5, regular);
  text(page, "ENDEREÇO PARA DEVOLUÇÃO DO AR", x + 10, y + 40, 6, bold);
  const senderStreet = `${sender.endereco}, ${sender.numero}${sender.complemento ? ` - ${sender.complemento}` : ""}`;
  fit(page, sender.nome.toUpperCase(), x + 10, y + 42.5, 94, 6, regular);
  fit(page, senderStreet.toUpperCase(), x + 10, y + 45, 94, 6, regular);
  text(page, sender.bairro.toUpperCase(), x + 10, y + 47.5, 6, regular);
  text(page, `${sender.cep} - ${sender.cidade.toUpperCase()} - ${sender.uf}`, x + 10, y + 50, 6, regular);
  text(page, "UNIDADE DE POSTAGEM", right + 0.7, y + 10.5, 6, bold);
  line(page, right, y + 16, x + 140, y + 16);
  text(page, "CARIMBO / UNIDADE DE ENTREGA", right + 2, y + 19, 5.5, bold);
  const motiveX = x + 56;
  line(page, motiveX, y + 52, motiveX, y + 80);
  line(page, motiveX, y + 59, x + 140, y + 59);
  text(page, "TENTATIVAS DE ENTREGA", x + 18, y + 54.5, 5.5, bold);
  ["1ª ______/______/______     ______:______h", "2ª ______/______/______     ______:______h", "3ª ______/______/______     ______:______h"].forEach((v, i) => text(page, v, x + 9.5, y + 61 + i * 7, 6, regular));
  text(page, "OBSERVAÇÃO:", motiveX + 0.5, y + 54.5, 6, bold);
  if (data.observacao) fit(page, data.observacao.toUpperCase(), motiveX + 18, y + 54.5, 60, 6, regular);
  text(page, "MOTIVO DE DEVOLUÇÃO", motiveX + 12, y + 61.5, 6, bold);
  const reasonsA = ["Mudou-se", "Endereço insuficiente", "Não existe o número", "Desconhecido", "Outros: __________________"];
  const reasonsB = ["Recusado", "Não procurado", "Ausente", "Falecido"];
  reasonsA.forEach((v, i) => {
    const top = y + 66 + i * 3.2;
    rect(page, motiveX + 2, top - 3, 2.5, 2.5, 0.2);
    text(page, String(i === 4 ? 9 : i + 1), motiveX + 2.7, top - 1, 5.5, regular);
    text(page, v, motiveX + 5.5, top - 1, 5.5, regular);
  });
  reasonsB.forEach((v, i) => {
    const top = y + 66 + i * 3.2;
    rect(page, motiveX + 32, top - 3, 2.5, 2.5, 0.2);
    text(page, String(i + 5), motiveX + 32.7, top - 1, 5.5, regular);
    text(page, v, motiveX + 35.5, top - 1, 5.5, regular);
  });
  text(page, "RUBRICA E MATRÍCULA DO", right + 0.7, y + 61.5, 5.5, bold);
  text(page, "CARTEIRO", right + 0.7, y + 64, 5.5, bold);
  line(page, x + 8, y + 80, x + 140, y + 80);
  line(page, x + 8, y + 87, x + 140, y + 87);
  text(page, "ASSINATURA DO RECEBEDOR", x + 8.4, y + 82.5, 6, bold);
  text(page, "DATA DE ENTREGA", right + 0.7, y + 82.5, 6, bold);
  text(page, "NOME LEGÍVEL DO RECEBEDOR", x + 8.4, y + 89.5, 6, bold);
  text(page, "Nº DOC. DE IDENTIDADE", right + 0.7, y + 89.5, 6, bold);
}


const CODE128_PATTERNS = [
"212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112",
];
// prettier-ignore
export function encodeCode128B(value) {
 const input=String(value??"");
 if(!input||[...input].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)>126)) return [];
 const data=[...input].map(c=>c.charCodeAt(0)-32);
 const checksum=data.reduce((sum,code,index)=>sum+code*(index+1),104)%103;
 return [104,...data,checksum,106];
}

// O JsBarcode usa o conjunto C para CEPs numéricos pares, reduzindo o
// comprimento do código sem alterar o conteúdo codificado.
export function encodeCode128C(value) {
 const input=String(value??"");
 if(!/^\\d{2,}$/.test(input)||input.length%2!==0) return [];
 const data=input.match(/\\d{2}/g).map(Number);
 const checksum=data.reduce((sum,code,index)=>sum+code*(index+1),105)%103;
 return [105,...data,checksum,106];
}
// prettier-ignore
function drawCode128(page,value,x,y,width,height) {
 const symbols=encodeCode128C(value);
 if(!symbols.length) return;
 const patterns=symbols.map(symbol=>CODE128_PATTERNS[symbol]);
 const moduleCount=patterns.reduce((sum,pattern)=>sum+[...pattern].reduce((total,run)=>total+Number(run),0),0);
 const moduleWidth=width/moduleCount;
 let cursor=0;
 patterns.forEach(pattern=>[...pattern].forEach((run,index)=>{
  const barWidth=Number(run)*moduleWidth;
  if(index%2===0) page.drawRectangle({x:mm(x+cursor),y:yTop(y+height),width:mm(barWidth),height:mm(height),color:rgb(0,0,0)});
  cursor+=barWidth;
 }));
}

// prettier-ignore
function drawLabel(page, x, y, data, title, fonts, logo) {
  const { regular, bold } = fonts;
  rect(page, x, y, 96, 45);
  page.drawRectangle({ x: mm(x), y: yTop(y + 5.5), width: mm(35), height: mm(5.5), color: rgb(0, 0, 0) });
  text(page, title, x + (title === "DESTINATÁRIO" ? 5.5 : 7.5), y + 4, 9, bold, rgb(1, 1, 1));
  if (logo) page.drawImage(logo, { x: mm(x + 80), y: yTop(y + 4.2), width: mm(14), height: mm(3) });
  else text(page, "Correios", x + 83, y + 4, 7, bold);
  fit(page, data.nome, x + 2, y + 8, 90, 6.5, regular);
  text(page, `${data.endereco}, ${data.numero}`, x + 2, y + 11, 6.5, regular);
  let lineY = y + 14;
  if (data.complemento) { text(page, data.complemento, x + 2, lineY, 6.5, regular); lineY += 3; }
  text(page, data.bairro, x + 2, lineY, 6.5, regular);
  const cepY = y + 21.5 + (data.complemento ? 3 : 0);
  text(page, data.cep, x + 2, cepY, 8, bold);
  text(page, `${data.cidade}-${data.uf}`, x + 25, cepY, 8, regular);
  // Código de barras Code 128 do CEP, nas dimensões do layout legado.
  drawCode128(page, String(data.cep ?? "").replace(/\D/g, ""), x + 4, y + 23, 47, 20);
  if (data.observacao && title === "DESTINATÁRIO") {
    text(page, "Observação:", x + 55, y + 26, 8.5, bold);
    fit(page, data.observacao, x + 55, y + 30.5, 38, 8, regular);
  }
}

// prettier-ignore
export async function generateArPdf(records, includeSenderLabels, logoBytes, now) {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  let logo = null;
  if (logoBytes) {
    try { logo = await pdf.embedPng(logoBytes); } catch { logo = null; }
  }
  for (let index = 0; index < records.length; index += 2) {
    const page = pdf.addPage([mm(pageW), mm(pageH)]);
    drawAR(page, 35, 25, records[index], fonts, logo);
    if (records[index + 1]) drawAR(page, 35, 155, records[index + 1], fonts, logo);
  }
  const labels = records.flatMap((record) => [
    { data: record, title: "DESTINATÁRIO" },
    ...(includeSenderLabels ? [{ data: record.remetente, title: "REMETENTE" }] : []),
  ]);
  for (let offset = 0; offset < labels.length; offset += 8) {
    const page = pdf.addPage([mm(pageW), mm(pageH)]);
    labels.slice(offset, offset + 8).forEach((label, i) => {
      drawLabel(page, 7 + (i % 2) * 98, 8.5 + Math.floor(i / 2) * 47, label.data, label.title, fonts, logo);
    });
  }
  return {
    bytes: await pdf.save(),
    filename: `AR_e_Etiquetas_${getFormattedTimestamp(now)}.pdf`,
    pageCount: pdf.getPageCount(),
  };
}
