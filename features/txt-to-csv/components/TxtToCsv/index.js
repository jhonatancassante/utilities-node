// features/txt-to-csv/components/TxtToCsv/index.js
import DataTable from "@/components/DataTable";
import { useMemo, useState } from "react";
import Button from "@/components/Button";
import FileDropzone from "@/components/FileDropzone";
import HelpToggle from "@/components/HelpToggle";
import StatusMessage from "@/components/StatusMessage";
import { downloadBlob } from "@/lib/client/files.js";
import shared from "@/styles/shared.module.css";
import {
  decodeBuffer,
  formatValue,
  parseFixedWidth,
  toCsv,
} from "../../lib/txt.js";
import styles from "./index.module.css";

const DEFAULT_LABEL = "Clique ou arraste o arquivo TXT aqui";
const PREVIEW_ROWS = 15;

function SwitchOption({ id, label, checked, onChange }) {
  return (
    <label className={styles.switchRow} htmlFor={id}>
      <span className={styles.switchText}>{label}</span>
      <span className={styles.switchControl}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={onChange}
        />
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchThumb} />
        </span>
      </span>
      <span className={styles.switchState}>{checked ? "Sim" : "Não"}</span>
    </label>
  );
}

function TxtToCsv() {
  const [currentFile, setCurrentFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [encoding, setEncoding] = useState("");
  const [separator, setSeparator] = useState(";");
  const [includeBom, setIncludeBom] = useState(true);
  const [dateOnly, setDateOnly] = useState(true);
  const [decimalDot, setDecimalDot] = useState(false);
  const [fileError, setFileError] = useState("");

  const generatedCsv = useMemo(() => {
    if (!parsed) return "";

    return toCsv(parsed.headers, parsed.rows, {
      separator: separator === "tab" ? "\t" : separator,
      dateOnly,
      decimalDot,
    });
  }, [parsed, separator, dateOnly, decimalDot]);

  const displayedError = fileError;

  async function handleFiles(files) {
    const file = files[0];

    if (!file) return;

    if (
      !file.name.toLowerCase().endsWith(".txt") &&
      file.type !== "text/plain"
    ) {
      setParsed(null);
      setCurrentFile(null);
      setFileError("Selecione apenas arquivos com a extensão .txt.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const decoded = decodeBuffer(buffer);
      const result = parseFixedWidth(decoded.text);

      setCurrentFile(file);
      setEncoding(decoded.encoding);
      setParsed(result);
      setFileError("");
    } catch (error) {
      setParsed(null);
      setCurrentFile(null);
      setFileError(
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo. Tente novamente.",
      );
    }
  }

  function handleDownload() {
    if (!parsed || !generatedCsv) return;

    const content = (includeBom ? "\uFEFF" : "") + generatedCsv;
    const blob = new Blob([content], {
      type: "text/csv;charset=utf-8",
    });
    const baseName = currentFile?.name.replace(/\.[^.]+$/, "") || "relatorio";

    downloadBlob(blob, `${baseName}.csv`);
  }

  function handleClear() {
    setCurrentFile(null);
    setParsed(null);
    setEncoding("");
    setFileError("");
  }

  return (
    <div className={styles.converter}>
      <HelpToggle>
        <strong>Como funciona:</strong> envie um relatório <strong>.txt</strong>{" "}
        com colunas de largura fixa. A primeira linha pode conter apenas um
        título (por exemplo, <em>REFISNO Relatório</em>) ou já trazer os nomes
        das colunas. Quando houver título, o cabeçalho deve estar na segunda
        linha. O arquivo é processado inteiramente no navegador.
      </HelpToggle>

      <FileDropzone
        label={currentFile ? currentFile.name : DEFAULT_LABEL}
        ariaLabel="Clique ou arraste um arquivo TXT para enviar"
        accept=".txt,text/plain"
        onFiles={handleFiles}
      />

      <StatusMessage type="error">{displayedError}</StatusMessage>

      <section className={styles.configPanel} aria-label="Configurações do CSV">
        <div className={styles.settingsRow}>
          <div className={styles.settingField}>
            <label htmlFor="txt-csv-separator" className={shared.label}>
              Separador do CSV
            </label>
            <select
              id="txt-csv-separator"
              className={shared.input}
              value={separator}
              onChange={(event) => setSeparator(event.target.value)}
            >
              <option value=";">Ponto e vírgula (;) — Excel pt-BR</option>
              <option value=",">Vírgula (,)</option>
              <option value="tab">Tabulação</option>
            </select>
          </div>
        </div>

        <div className={styles.settingBlock}>
          <h2 className={styles.sectionTitle}>Opções de conversão</h2>
          <div className={styles.switchesContainer}>
            <SwitchOption
              id="txt-csv-bom"
              label="Incluir BOM UTF-8 (acentos corretos no Excel)"
              checked={includeBom}
              onChange={(event) => setIncludeBom(event.target.checked)}
            />
            <SwitchOption
              id="txt-csv-date-only"
              label="Exibir só a data, sem a hora (26/10/2026 00:00:00 → 26/10/2026)"
              checked={dateOnly}
              onChange={(event) => setDateOnly(event.target.checked)}
            />
            <SwitchOption
              id="txt-csv-decimal-dot"
              label="Trocar vírgula decimal por ponto (1234,56 → 1234.56)"
              checked={decimalDot}
              onChange={(event) => setDecimalDot(event.target.checked)}
            />
          </div>
        </div>
      </section>

      {parsed && (
        <section className={styles.result} aria-label="Resultado da conversão">
          <p className={styles.stats}>
            {parsed.rows.length} linhas de dados · {parsed.headers.length}{" "}
            colunas · codificação {encoding}
            {parsed.title ? ` · título ignorado: "${parsed.title}"` : ""}
            {" · "}cabeçalho na linha {parsed.headerLineNumber}
          </p>

          {parsed.misaligned > 0 && (
            <StatusMessage type="error">
              {parsed.misaligned} linha(s) têm texto cruzando o limite de uma
              coluna. Confira a prévia: o arquivo pode não ser de largura fixa
              exata.
            </StatusMessage>
          )}

          <DataTable
            records={parsed.rows.slice(0, PREVIEW_ROWS)}
            caption="Prévia das primeiras linhas do arquivo convertido"
            getRowKey={(_, index) => index}
            monospace
            maxHeight="420px"
            columns={parsed.headers.map((header, index) => ({
              key: String(index),
              label: header,
              sortable: false,
              render: (row) =>
                formatValue(row[index], { dateOnly, decimalDot }),
            }))}
          />

          <p className={styles.settingHint}>Prévia das primeiras 15 linhas.</p>

          <div className={styles.actions}>
            <Button
              icon="fa-download"
              onClick={handleDownload}
              disabled={!generatedCsv}
            >
              Baixar CSV
            </Button>
            <Button variant="danger" icon="fa-trash-alt" onClick={handleClear}>
              Limpar
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

export default TxtToCsv;
