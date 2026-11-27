const units = ["zero","um","dois","três","quatro","cinco","seis","sete","oito","nove"];
const teens = ["dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
const tens = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
const hundreds = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];

function spellGroup(value) {
  if (value === 100) return "cem";
  const parts = [];
  const hundred = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundred) parts.push(hundreds[hundred]);
  if (remainder >= 10 && remainder <= 19) {
    parts.push(teens[remainder - 10]);
  } else {
    const ten = Math.floor(remainder / 10);
    const unit = remainder % 10;
    if (ten) parts.push(tens[ten]);
    if (unit) parts.push(units[unit]);
  }
  return parts.join(" e ");
}

export function numberToPortugueseWords(value) {
  const number = Math.floor(Math.abs(Number(value)));
  if (!Number.isFinite(number) || number === 0) return "zero";
  const groups = [
    { value: Math.floor(number / 1_000_000_000), one: "bilhão", many: "bilhões" },
    { value: Math.floor(number / 1_000_000) % 1000, one: "milhão", many: "milhões" },
    { value: Math.floor(number / 1000) % 1000, one: "mil", many: "mil" },
    { value: number % 1000, one: "", many: "" },
  ].filter((group) => group.value > 0);
  const parts = groups.map((group) => {
    if (group.one === "mil" && group.value === 1) return "mil";
    const words = spellGroup(group.value);
    return group.one ? words + " " + (group.value === 1 ? group.one : group.many) : words;
  });
  return parts.map((part, index) => {
    if (index === 0) return part;
    const lastGroup = index === parts.length - 1;
    return (lastGroup && groups[index].value < 100 ? " e " : ", ") + part;
  }).join("");
}

export function amountToPortugueseWords(value) {
  const amount = Math.abs(Number(value) || 0);
  const [integerText, centsText] = amount.toFixed(2).split(".");
  const integer = Number(integerText);
  const cents = Number(centsText);
  let words = numberToPortugueseWords(integer) + (integer === 1 ? " real" : " reais");
  if (cents) words += " e " + numberToPortugueseWords(cents) + (cents === 1 ? " centavo" : " centavos");
  return words.charAt(0).toLocaleUpperCase("pt-BR") + words.slice(1);
}

export function getCertificateDiscountPercentage(record) {
  if (!record?.owner_rg || !String(record.owner_rg).trim()) return 0;
  const area = Number(record.land_area);
  if (!Number.isFinite(area) || area < 0) return 0;
  if (area <= 500) return 50;
  if (area <= 1000) return 30;
  return 0;
}

export function formatCertificateCurrency(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatCertificateArea(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
