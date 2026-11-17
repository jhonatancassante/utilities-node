// features/csv-to-json/components/CsvToJson/index.js
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import FileDropzone from "@/components/FileDropzone";
import HelpToggle from "@/components/HelpToggle";
import StatusMessage from "@/components/StatusMessage";
import { downloadBlob } from "@/lib/files.js";
import shared from "@/styles/shared.module.css";
import { createJson, parseCsv } from "../../lib/csv.js";
import styles from "./index.module.css";

const DEFAULT_LABEL = "Clique ou arraste o arquivo CSV aqui";
const MAX_PREVIEW_LINES = 15;
const MAX_LINE_PREVIEW_CHARS = 140;

function getPreviewLines(lines) {
  return lines.slice(0, MAX_PREVIEW_LINES).map((line, index) => ({
    index,
    text:
      line.length > MAX_LINE_PREVIEW_CHARS
        ? `${line.slice(0, MAX_LINE_PREVIEW_CHARS)}…`
        : line || "(linha em branco)",
  }));
}

function CsvToJson() {
  const [currentFile, setCurrentFile] = useState(null);
  const [rawLines, setRawLines] = useState([]);
  const [headerLineIndex, setHeaderLineIndex] = useState(0);
  const [encoding, setEncoding] = useState("ISO-8859-1");
  const [delimiter, setDelimiter] = useState("auto");
  const [selectedFields, setSelectedFields] = useState(null);
  const [fileError, setFileError] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const parsed = useMemo(() => {
    if (!rawLines.length) {
      return { data: [], fields: [], error: "" };
    }

    return parseCsv(rawLines.slice(headerLineIndex).join("\n"), delimiter);
  }, [rawLines, headerLineIndex, delimiter]);

  const activeFields = parsed.fields.filter(
    (field) => selectedFields === null || selectedFields.includes(field),
  );

  const generatedJson = useMemo(
    () => createJson(parsed.data, activeFields),
    [parsed.data, activeFields],
  );

  const previewLines = useMemo(() => getPreviewLines(rawLines), [rawLines]);

  const outputMessage = !parsed.fields.length
    ? "Não foi possível identificar colunas nesta linha. Escolha outra linha de cabeçalho."
    : !parsed.data.length
      ? "O cabeçalho foi identificado, mas não há registros para converter."
      : !activeFields.length
        ? "Selecione ao menos uma coluna para gerar o JSON."
        : generatedJson;

  const displayedError =
    fileError ||
    parsed.error ||
    (!parsed.fields.length && rawLines.length
      ? "Não foi possível identificar colunas nesta linha. Escolha outra linha de cabeçalho."
      : "");

  useEffect(() => {
    if (!isCopied) return undefined;

    const timeoutId = window.setTimeout(() => setIsCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [isCopied]);

  function handleFiles(files) {
    const file = files[0];

    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Selecione apenas arquivos com a extensão .csv.");
      return;
    }

    setCurrentFile(file);
    setFileError("");
    setRawLines([]);
    setHeaderLineIndex(0);
    setSelectedFields(null);
    loadFile(file, encoding);
  }

  function loadFile(file, selectedEncoding) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      const content = String(event.target.result ?? "");
      const lines = content.split(/\r?\n/);

      while (lines.length && lines[lines.length - 1].trim() === "") {
        lines.pop();
      }

      if (!lines.length) {
        setRawLines([]);
        setFileError("O arquivo selecionado está vazio.");
        return;
      }

      setRawLines(lines);
      setHeaderLineIndex(0);
      setSelectedFields(null);
      setFileError("");
    };

    reader.onerror = () => {
      setFileError("Não foi possível ler o arquivo. Tente novamente.");
    };

    reader.readAsText(file, selectedEncoding);
  }

  function handleEncodingChange(event) {
    const nextEncoding = event.target.value;
    setEncoding(nextEncoding);
    loadFile(currentFile, nextEncoding);
  }

  function handleDelimiterChange(event) {
    setDelimiter(event.target.value);
    setSelectedFields(null);
  }

  function handleHeaderChange(event) {
    setHeaderLineIndex(Number(event.target.value));
    setSelectedFields(null);
  }

  function handleColumnChange(field, checked) {
    setSelectedFields((current) => {
      const fields = current === null ? parsed.fields : current;

      return checked
        ? [...fields, field]
        : fields.filter((selectedField) => selectedField !== field);
    });
  }

  function handleSelectAll() {
    setSelectedFields(parsed.fields);
  }

  function handleSelectNone() {
    setSelectedFields([]);
  }

  async function handleCopy() {
    if (!generatedJson) return;

    try {
      await navigator.clipboard.writeText(generatedJson);
      setIsCopied(true);
      setFileError("");
    } catch {
      setFileError(
        "Não foi possível copiar o JSON automaticamente. Verifique as permissões do navegador.",
      );
    }
  }

  function handleDownload() {
    if (!generatedJson) return;

    const blob = new Blob([generatedJson], {
      type: "application/json;charset=utf-8",
    });

    downloadBlob(blob, "dados_convertidos.json");
  }

  function handleClear() {
    setCurrentFile(null);
    setRawLines([]);
    setHeaderLineIndex(0);
    setDelimiter("auto");
    setEncoding("ISO-8859-1");
    setSelectedFields(null);
    setFileError("");
    setIsCopied(false);
  }

  return (
    <div className={styles.converter}>
      <HelpToggle>
        <strong>Como funciona:</strong> envie um arquivo CSV e ajuste, se
        necessário, a codificação e o delimitador. Escolha a linha que contém os
        nomes das colunas e marque quais delas deseja incluir. O JSON é gerado
        automaticamente e pode ser copiado ou baixado. Todo o processamento
        acontece no navegador; o arquivo não é enviado a um servidor.
      </HelpToggle>

      <FileDropzone
        label={currentFile ? currentFile.name : DEFAULT_LABEL}
        ariaLabel="Clique ou arraste um arquivo CSV para enviar"
        accept=".csv,text/csv"
        onFiles={handleFiles}
      />

      <StatusMessage type="error">{displayedError}</StatusMessage>

      {rawLines.length > 0 && (
        <section
          className={styles.configPanel}
          aria-label="Configurações do CSV"
        >
          <div className={styles.settingsRow}>
            <div className={styles.settingField}>
              <label htmlFor="csv-encoding" className={shared.label}>
                Codificação do arquivo
              </label>
              <select
                id="csv-encoding"
                className={shared.input}
                value={encoding}
                onChange={handleEncodingChange}
              >
                <option value="ISO-8859-1">
                  ISO-8859-1 / Latin1 (padrão em exportações de sistemas
                  municipais)
                </option>
                <option value="UTF-8">UTF-8</option>
              </select>
            </div>

            <div className={styles.settingField}>
              <label htmlFor="csv-delimiter" className={shared.label}>
                Delimitador
              </label>
              <select
                id="csv-delimiter"
                className={shared.input}
                value={delimiter}
                onChange={handleDelimiterChange}
              >
                <option value="auto">Detectar automaticamente</option>
                <option value=";">Ponto e vírgula ( ; )</option>
                <option value=",">Vírgula ( , )</option>
                <option value="\t">Tabulação</option>
              </select>
            </div>
          </div>

          <div className={styles.settingBlock}>
            <h2 className={styles.sectionTitle}>
              Selecione a linha de cabeçalho
            </h2>
            <p className={styles.settingHint}>
              Escolha a linha que contém os nomes das colunas. Use esta opção
              quando o arquivo tiver títulos ou informações antes dos dados.
            </p>

            <div className={styles.headerLineList}>
              {previewLines.map(({ index, text }) => (
                <label
                  key={index}
                  className={`${styles.headerLineItem} ${headerLineIndex === index ? styles.selected : ""}`}
                >
                  <input
                    type="radio"
                    name="csv-header-line"
                    value={index}
                    checked={headerLineIndex === index}
                    onChange={handleHeaderChange}
                  />
                  <span className={styles.lineNumber}>{index + 1}</span>
                  <span className={styles.lineText}>{text}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.settingBlock}>
            <div className={styles.columnsHeader}>
              <h2 className={styles.sectionTitle}>Colunas a incluir no JSON</h2>
              <div className={styles.selectGroup}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={handleSelectAll}
                  disabled={!parsed.fields.length}
                >
                  Selecionar todas
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={handleSelectNone}
                  disabled={!parsed.fields.length}
                >
                  Limpar seleção
                </button>
              </div>
            </div>

            {parsed.fields.length > 0 ? (
              <div className={styles.columnsGrid}>
                {parsed.fields.map((field, index) => {
                  const label =
                    field && field.trim() ? field : `(coluna ${index + 1})`;
                  const id = `csv-column-${index}`;

                  return (
                    <div key={id} className={styles.columnItem}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={activeFields.includes(field)}
                        onChange={(event) =>
                          handleColumnChange(field, event.target.checked)
                        }
                      />
                      <label htmlFor={id}>{label}</label>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.settingHint}>
                Nenhuma coluna identificada nesta linha de cabeçalho.
              </p>
            )}
          </div>
        </section>
      )}

      {rawLines.length > 0 && (
        <section className={styles.jsonContainer} aria-labelledby="json-title">
          <h2 id="json-title" className={styles.sectionTitle}>
            Resultado do JSON
          </h2>
          <div className={styles.jsonOutputWrapper}>
            <pre className={styles.jsonOutput}>
              <code>{outputMessage}</code>
            </pre>
            {generatedJson && (
              <button
                type="button"
                className={`${styles.copyButton} ${isCopied ? styles.copied : ""}`}
                onClick={handleCopy}
                aria-label={isCopied ? "Código copiado" : "Copiar código JSON"}
                title={isCopied ? "Código copiado" : "Copiar código"}
              >
                <i
                  className={`fas ${isCopied ? "fa-check" : "fa-copy"}`}
                  aria-hidden="true"
                ></i>
              </button>
            )}
          </div>
        </section>
      )}

      {generatedJson && (
        <div className={styles.actions}>
          <Button icon="fa-download" onClick={handleDownload}>
            Baixar JSON
          </Button>
          <Button variant="danger" icon="fa-trash-alt" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      )}

      {currentFile && !generatedJson && (
        <div className={styles.actions}>
          <Button variant="danger" icon="fa-trash-alt" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}

export default CsvToJson;
