import { useState } from "react";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const CSV_FIELDS = [
  ["IdFisico", "physical_property_id"],
  ["InscrFisico", "physical_registration"],
  ["Ctm", "ctm"],
  ["CtmCount", "ctm_count"],
  ["Englobamento", "grouping"],
  ["ImovelQuadra", "property_block"],
  ["ImovelLotes", "property_lots"],
  ["AreaTerreno", "land_area"],
  ["AreaEdificada", "built_area"],
  ["ImovelBairro", "property_neighborhood"],
  ["Proprietario", "owner_name"],
  ["Compromissario", "promissory_buyer"],
  ["SetorTerreno", "land_sector"],
  ["ImovelLogradouro", "property_street"],
  ["ImovelNumero", "property_number"],
  ["ImovelComplemento", "property_complement"],
  ["TipoConstr", "construction_type"],
  ["FracaoIdeal", "ideal_fraction"],
  ["Pontos", "points"],
];
const REQUIRED_FIELDS = [
  "physical_property_id",
  "physical_registration",
  "ctm",
  "ctm_count",
  "grouping",
  "land_area",
  "property_neighborhood",
  "owner_name",
  "land_sector",
  "property_street",
];
const NULLABLE_FIELDS = [
  "property_block",
  "property_lots",
  "promissory_buyer",
  "property_number",
  "property_complement",
  "construction_type",
  "ideal_fraction",
  "points",
];
const INTEGER_FIELDS = [
  "physical_property_id",
  "ctm_count",
  "land_sector",
  "construction_type",
  "points",
];
const NUMBER_FIELDS = [
  "land_area",
  "built_area",
  "property_number",
  "ideal_fraction",
];

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
      } else quoted = !quoted;
    } else if (character === ";" && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("O arquivo contém aspas não fechadas.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseValue(field, raw, rowNumber) {
  const value = raw.trim();
  if (!value) {
    if (REQUIRED_FIELDS.includes(field))
      throw new Error(
        "Linha " + rowNumber + ": o campo " + field + " é obrigatório.",
      );
    if (NULLABLE_FIELDS.includes(field)) return null;
    if (field === "built_area") return 0;
    return undefined;
  }
  if (INTEGER_FIELDS.includes(field) || NUMBER_FIELDS.includes(field)) {
    const normalized = value.includes(",")
      ? value.replace(/\./g, "").replace(",", ".")
      : value;
    const number = Number(normalized);
    if (
      !Number.isFinite(number) ||
      number < 0 ||
      (INTEGER_FIELDS.includes(field) && !Number.isInteger(number)) ||
      (NUMBER_FIELDS.includes(field) &&
        Math.round(number * 100) / 100 !== number)
    ) {
      throw new Error(
        "Linha " +
          rowNumber +
          ": valor numérico inválido no campo " +
          field +
          ".",
      );
    }
    return number;
  }
  return value;
}

function RealEstatePropertyBulkModal({ onClose, onSubmit, isSaving }) {
  const [file, setFile] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isUpdated, setIsUpdated] = useState(false);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");

  function handleReadFile() {
    if (
      !year.trim() ||
      !Number.isInteger(Number(year)) ||
      Number(year) < 1 ||
      Number(year) > 9999
    ) {
      setError("Informe um ano válido antes de ler o arquivo.");
      return;
    }
    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(
          String(reader.result || "").replace(/^\uFEFF/, ""),
        );
        if (rows.length < 2)
          throw new Error(
            "O arquivo precisa conter cabeçalho e ao menos um imóvel.",
          );
        if (rows.length - 1 > 500)
          throw new Error("O limite por importação é de 500 imóveis.");
        const headers = rows[0].map((header) => header.trim().toLowerCase());
        const expectedHeaders = CSV_FIELDS.map(([header]) =>
          header.toLowerCase(),
        );
        const missing = expectedHeaders.filter(
          (field) => !headers.includes(field),
        );
        const duplicates = headers.filter(
          (field, index) => headers.indexOf(field) !== index,
        );
        const unexpected = headers.filter(
          (field) => !expectedHeaders.includes(field),
        );
        if (missing.length)
          throw new Error("Colunas ausentes: " + missing.join(", ") + ".");
        if (duplicates.length)
          throw new Error("O cabeçalho contém colunas duplicadas.");
        if (unexpected.length)
          throw new Error(
            "Colunas não reconhecidas: " + unexpected.join(", ") + ".",
          );
        const indexes = Object.fromEntries(
          CSV_FIELDS.map(([header, field]) => [
            field,
            headers.indexOf(header.toLowerCase()),
          ]),
        );
        const parsed = rows.slice(1).map((row, index) => {
          if (row.length !== headers.length)
            throw new Error(
              "Linha " +
                (index + 2) +
                ": quantidade de colunas diferente do cabeçalho.",
            );
          const record = { year: Number(year), annual: !isUpdated };
          for (const [, field] of CSV_FIELDS) {
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
    reader.onerror = () =>
      setError("Não foi possível ler o arquivo selecionado.");
    reader.readAsText(file, "UTF-8");
  }

  return (
    <Modal title="Importar imóveis em lote" onClose={onClose} wide>
      <div className={styles.content}>
        <p>
          Informe o exercício e a situação de atualização. O CSV deve conter os
          19 cabeçalhos do cadastro e pode importar até 500 imóveis por
          operação.
        </p>
        <div className={styles.importSettings}>
          <label>
            <span className={shared.label}>Ano *</span>
            <input
              className={shared.input}
              type="number"
              min="1"
              max="9999"
              step="1"
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setRecords(null);
                setError("");
              }}
              required
            />
          </label>
          <label className={styles.switchField}>
            <span className={shared.label}>Atualizado</span>
            <span className={styles.switchControl}>
              <input
                type="checkbox"
                role="switch"
                checked={isUpdated}
                onChange={(event) => {
                  setIsUpdated(event.target.checked);
                  setRecords(null);
                  setError("");
                }}
              />
              <span aria-hidden="true"></span>
            </span>
          </label>
        </div>
        <label className={styles.fileField}>
          <span className={shared.label}>Arquivo CSV *</span>
          <input
            className={shared.input}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setRecords(null);
              setError("");
            }}
          />
        </label>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            icon="fa-eye"
            onClick={handleReadFile}
            disabled={!file || isSaving || !year.trim()}
          >
            Ler e validar
          </Button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {records && (
          <div className={styles.preview}>
            <strong>{records.length} imóvel(is) validados.</strong>
            <p>
              Ano: {year} · Atualizado: {isUpdated ? "Sim" : "Não"}. Os valores
              foram aplicados a todos os registros.
            </p>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                icon="fa-file-import"
                onClick={() => onSubmit(records)}
                disabled={isSaving}
              >
                {isSaving ? "Importando..." : "Importar imóveis"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default RealEstatePropertyBulkModal;
