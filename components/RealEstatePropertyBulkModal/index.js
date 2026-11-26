import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Button from "@/components/Button";
import FileDropzone from "@/components/FileDropzone";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";
import getGroupingIssues from "@/lib/client/real-estate-property-grouping.js";
import {
  deleteRealEstatePropertyImportDraft,
  getRealEstatePropertyImportDraft,
  saveRealEstatePropertyImportDraft,
} from "@/lib/client/real-estate-property-import-draft.js";

const MAX_IMPORT_RECORDS = 100000;

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
  "construction_type",
  "points",
];
const NUMBER_FIELDS = [
  "land_area",
  "built_area",
  "property_number",
  "ideal_fraction",
];

function parseCsv(source, delimiter) {
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
    } else if (character === delimiter && !quoted) {
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

function RealEstatePropertyBulkModal({ onSubmit, isSaving }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [encoding, setEncoding] = useState("UTF-8");
  const [delimiter, setDelimiter] = useState(";");
  const [isUpdated, setIsUpdated] = useState(false);
  const [records, setRecords] = useState(null);
  const [groupingIssues, setGroupingIssues] = useState([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let active = true;
    getRealEstatePropertyImportDraft()
      .then((draft) => {
        if (!active || !draft) return;
        setRecords(draft);
        setYear(String(draft[0]?.year ?? new Date().getFullYear()));
        setIsUpdated(Boolean(draft[0]?.annual) === false);
        setGroupingIssues(getGroupingIssues(draft));
      })
      .catch(() => {
        if (active) setError("Não foi possível recuperar a prévia salva neste navegador.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleOpenGroupingReview() {
    try {
      await saveRealEstatePropertyImportDraft(records);
      await router.push("/admin/real-estate-properties/import-review");
    } catch {
      setError("Não foi possível preparar a página de correção. Verifique o armazenamento do navegador.");
    }
  }

  async function handleReadFile() {
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
    try {
      const buffer = await file.arrayBuffer();
      let source;
      try {
        source = new TextDecoder(encoding, { fatal: true }).decode(buffer);
      } catch {
        throw new Error(
          "O arquivo não corresponde à codificação selecionada (" +
            encoding +
            ").",
        );
      }
      const rows = parseCsv(
        source.replace(/^\uFEFF/, ""),
        delimiter === "tab" ? "\t" : delimiter,
      );
      if (rows.length < 2) {
        throw new Error(
          "O arquivo precisa conter cabeçalho e ao menos um imóvel.",
        );
      }
      if (rows.length - 1 > MAX_IMPORT_RECORDS) {
        throw new Error(
          "O limite por importação é de " +
            MAX_IMPORT_RECORDS.toLocaleString("pt-BR") +
            " imóveis.",
        );
      }
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
      if (missing.length) {
        throw new Error("Colunas ausentes: " + missing.join(", ") + ".");
      }
      if (duplicates.length) {
        throw new Error("O cabeçalho contém colunas duplicadas.");
      }
      if (unexpected.length) {
        throw new Error(
          "Colunas não reconhecidas: " + unexpected.join(", ") + ".",
        );
      }
      const indexes = Object.fromEntries(
        CSV_FIELDS.map(([header, field]) => [
          field,
          headers.indexOf(header.toLowerCase()),
        ]),
      );
      const parsed = rows.slice(1).map((row, index) => {
        if (row.length !== headers.length) {
          throw new Error(
            "Linha " +
              (index + 2) +
              ": quantidade de colunas diferente do cabeçalho.",
          );
        }
        const record = { year: Number(year), annual: !isUpdated };
        for (const [, field] of CSV_FIELDS) {
          const value = parseValue(field, row[indexes[field]], index + 2);
          if (value !== undefined) record[field] = value;
        }
        return record;
      });
      setRecords(parsed);
      setGroupingIssues(getGroupingIssues(parsed));
      setProgress(null);
      setError("");
      await deleteRealEstatePropertyImportDraft();
    } catch (parseError) {
      setRecords(null);
      setGroupingIssues([]);
      setError(parseError.message);
    }
  }

  return (
    <section className={styles.importSection}>
      <div className={styles.sectionTitle}>
        <div>
          <h2>Importar imóveis por arquivo CSV</h2>
          <p>
            Informe o exercício e a situação de atualização. O arquivo deve
            conter os 19 campos do cadastro e pode importar até 100.000 imóveis.
          </p>
        </div>
        <i className="fas fa-file-csv" aria-hidden="true"></i>
      </div>
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
      <div className={styles.fileField}>
        <span className={shared.label}>Arquivo CSV *</span>
        <FileDropzone
          label="Arraste um arquivo CSV ou clique para selecionar"
          accept=".csv,text/csv"
          onFiles={(files) => {
            const selectedFile = files[0];
            if (!selectedFile) return;
            if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
              setFile(null);
              setRecords(null);
              setError("Selecione um arquivo com extensão .csv.");
              return;
            }
            setFile(selectedFile);
            setRecords(null);
            setError("");
          }}
        />
        {file && (
          <div className={styles.selectedFile}>
            <span>{file.name}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFile(null);
                setRecords(null);
                setError("");
              }}
              disabled={isSaving}
            >
              Limpar arquivo
            </Button>
          </div>
        )}
      </div>
      <div className={styles.formatSettings}>
        <label>
          <span className={shared.label}>Codificação *</span>
          <select
            className={shared.input}
            value={encoding}
            onChange={(event) => {
              setEncoding(event.target.value);
              setRecords(null);
              setError("");
            }}
          >
            <option value="UTF-8">UTF-8</option>
            <option value="windows-1252">Windows-1252 (ANSI)</option>
            <option value="ISO-8859-1">ISO-8859-1</option>
          </select>
        </label>
        <label>
          <span className={shared.label}>Delimitador *</span>
          <select
            className={shared.input}
            value={delimiter}
            onChange={(event) => {
              setDelimiter(event.target.value);
              setRecords(null);
              setError("");
            }}
          >
            <option value=";">Ponto e vírgula (;)</option>
            <option value=",">Vírgula (,)</option>
            <option value="tab">Tabulação</option>
          </select>
        </label>
      </div>
      <div className={styles.importActions}>
        <Button
          type="button"
          variant="outline"
          icon="fa-eye"
          onClick={handleReadFile}
          disabled={!file || isSaving || !year.trim()}
        >
          Ler e validar CSV
        </Button>
        {records && groupingIssues.length > 0 && (
          <Button
            type="button"
            variant="outline"
            icon="fa-triangle-exclamation"
            onClick={handleOpenGroupingReview}
            disabled={isSaving}
          >
            Revisar englobamento ({groupingIssues.length} CTM)
          </Button>
        )}
        {records && (
          <Button
            type="button"
            icon="fa-file-import"
            onClick={async () => {
              const succeeded = await onSubmit(records, setProgress);
              if (succeeded) {
                setFile(null);
                setRecords(null);
                setGroupingIssues([]);
                setError("");
                await deleteRealEstatePropertyImportDraft();
              }
            }}
            disabled={isSaving}
          >
            {isSaving
              ? "Importando..."
              : "Importar " + records.length + " imóvel(is)"}
          </Button>
        )}
      </div>
      {isSaving && (
        <div className={styles.importProgress} role="status" aria-live="polite">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>
            {progress?.stage === "uploading"
              ? "Enviando lote " +
                progress.current +
                " de " +
                progress.total +
                "..."
              : progress?.stage === "finalizing"
                ? "Finalizando a importação e gravando os imóveis..."
                : "Preparando a importação..."}{" "}
            Não feche esta página.
          </span>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {records && (
        <div className={styles.preview}>
          <div className={styles.previewHeading}>
            <strong>{records.length} imóvel(is) lidos.</strong>
            <span>
              Ano: {year} · Atualizado: {isUpdated ? "Sim" : "Não"}
            </span>
          </div>
          {groupingIssues.length > 0 ? (
            <div className={styles.groupingWarning} role="alert">
              <strong>Foram encontradas inconsistências de englobamento em {groupingIssues.length} CTM(s).</strong>
              <p>Revise os cadastros antes de importar. Este aviso não impede a gravação no banco de dados.</p>
            </div>
          ) : (
            <p>Nenhuma inconsistência de englobamento foi encontrada. Confira a quantidade antes de concluir a importação.</p>
          )}
        </div>
      )}
    </section>
  );
}

export default RealEstatePropertyBulkModal;
