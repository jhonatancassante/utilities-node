import { useState } from "react";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const CSV_FIELDS = [
  "year", "physical_property_id", "physical_registration", "ctm", "ctm_count",
  "grouping", "property_block", "property_lots", "land_area", "built_area",
  "property_neighborhood", "owner_name", "promissory_buyer", "land_sector",
  "property_street", "property_number", "property_complement", "construction_type",
  "ideal_fraction", "points", "annual",
];
const REQUIRED_FIELDS = [
  "year", "physical_property_id", "physical_registration", "ctm", "ctm_count",
  "grouping", "land_area", "property_neighborhood", "owner_name", "land_sector",
  "property_street",
];
const NULLABLE_FIELDS = [
  "property_block", "property_lots", "promissory_buyer", "property_number",
  "property_complement", "construction_type", "ideal_fraction", "points",
];
const INTEGER_FIELDS = [
  "year", "physical_property_id", "ctm_count", "land_sector",
  "construction_type", "points",
];
const NUMBER_FIELDS = ["land_area", "built_area", "property_number", "ideal_fraction"];

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ";" && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("O arquivo contém aspas não fechadas.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseValue(field, raw, rowNumber) {
  const value = raw.trim();
  if (!value) {
    if (REQUIRED_FIELDS.includes(field)) {
      throw new Error("Linha " + rowNumber + ": o campo " + field + " é obrigatório.");
    }
    if (NULLABLE_FIELDS.includes(field)) return null;
    return undefined;
  }
  if (field === "annual") {
    if (["true", "1", "sim"].includes(value.toLowerCase())) return true;
    if (["false", "0", "não", "nao"].includes(value.toLowerCase())) return false;
    throw new Error("Linha " + rowNumber + ": annual deve ser true/false, 1/0 ou sim/não.");
  }
  if (INTEGER_FIELDS.includes(field) || NUMBER_FIELDS.includes(field)) {
    const normalized = value.includes(",")
      ? value.replace(/\./g, "").replace(",", ".")
      : value;
    const number = Number(normalized);
    if (!Number.isFinite(number) || number < 0 ||
      (INTEGER_FIELDS.includes(field) && !Number.isInteger(number)) ||
      (NUMBER_FIELDS.includes(field) && Math.round(number * 100) / 100 !== number)) {
      throw new Error("Linha " + rowNumber + ": valor numérico inválido no campo " + field + ".");
    }
    return number;
  }
  return value;
}

function RealEstatePropertyBulkModal({ onClose, onSubmit, isSaving }) {
  const [file, setFile] = useState(null);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");

  function handleReadFile() {
    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || "").replace(/^\uFEFF/, ""));
        if (rows.length < 2) throw new Error("O arquivo precisa conter cabeçalho e ao menos um imóvel.");
        if (rows.length - 1 > 500) throw new Error("O limite por importação é de 500 imóveis.");
        const headers = rows[0].map((header) => header.trim().toLowerCase());
        const missing = CSV_FIELDS.filter((field) => !headers.includes(field));
        const duplicates = headers.filter((field, index) => headers.indexOf(field) !== index);
        if (missing.length) throw new Error("Colunas ausentes: " + missing.join(", ") + ".");
        if (duplicates.length) throw new Error("O cabeçalho contém colunas duplicadas.");
        const indexes = Object.fromEntries(CSV_FIELDS.map((field) => [field, headers.indexOf(field)]));
        const parsed = rows.slice(1).map((row, index) => {
          if (row.length !== headers.length) {
            throw new Error("Linha " + (index + 2) + ": quantidade de colunas diferente do cabeçalho.");
          }
          const record = {};
          for (const field of CSV_FIELDS) {
            const value = parseValue(field, row[indexes[field]], index + 2);
            if (value !== undefined) record[field] = value;
          }
          return record;
        });
        setRecords(parsed);
        setError("");
      } catch (parseError) {
        setRecords(null);
        setError(parseError.message);
      }
    };
    reader.onerror = () => setError("Não foi possível ler o arquivo selecionado.");
    reader.readAsText(file, "UTF-8");
  }

  function downloadTemplate() {
    const blob = new Blob(["\uFEFF" + CSV_FIELDS.join(";") + "\r\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-imoveis.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title="Importar imóveis em lote" onClose={onClose} wide>
      <div className={styles.content}>
        <p>Envie um CSV separado por ponto e vírgula. O cabeçalho deve usar os nomes técnicos dos campos. Até 500 imóveis por operação.</p>
        <label className={styles.fileField}>
          <span className={shared.label}>Arquivo CSV</span>
          <input className={shared.input} type="file" accept=".csv,text/csv"
            onChange={(event) => { setFile(event.target.files?.[0] || null); setRecords(null); setError(""); }} />
        </label>
        <div className={styles.actions}>
          <Button type="button" variant="outline" icon="fa-download" onClick={downloadTemplate}>Baixar modelo CSV</Button>
          <Button type="button" variant="outline" icon="fa-eye" onClick={handleReadFile} disabled={!file || isSaving}>Ler e validar</Button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {records && <div className={styles.preview}>
          <strong>{records.length} imóvel(is) validados.</strong>
          <p>Confira a quantidade antes de confirmar a importação.</p>
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
            <Button type="button" icon="fa-file-import" onClick={() => onSubmit(records)} disabled={isSaving}>
              {isSaving ? "Importando..." : "Importar imóveis"}
            </Button>
          </div>
        </div>}
      </div>
    </Modal>
  );
}

export default RealEstatePropertyBulkModal;
