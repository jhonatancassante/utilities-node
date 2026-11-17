// features/json-to-csv/components/JsonToCsv/index.js
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import FileDropzone from "@/components/FileDropzone";
import HelpToggle from "@/components/HelpToggle";
import StatusMessage from "@/components/StatusMessage";
import { downloadBlob } from "@/lib/files.js";
import shared from "@/styles/shared.module.css";
import {
  collectOrderedFields,
  createCsv,
  normalizeToRows,
  stringToLatin1Bytes,
} from "../../lib/json.js";
import styles from "./index.module.css";

const DEFAULT_LABEL = "Clique ou arraste o arquivo JSON aqui";

function JsonToCsv() {
  const [currentFile, setCurrentFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [delimiter, setDelimiter] = useState(";");
  const [encoding, setEncoding] = useState("utf8-bom");
  const [selectedFields, setSelectedFields] = useState(null);
  const [fileError, setFileError] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const fields = useMemo(
    () => collectOrderedFields(parsedRows),
    [parsedRows],
  );

  const activeFields = fields.filter(
    (field) => selectedFields === null || selectedFields.includes(field),
  );

  const generatedCsv = useMemo(
    () => createCsv(parsedRows, activeFields, delimiter),
    [parsedRows, activeFields, delimiter],
  );

  const outputMessage = activeFields.length
    ? generatedCsv
    : "Selecione ao menos uma coluna para gerar o CSV.";

  useEffect(() => {
    if (!isCopied) return undefined;

    const timeoutId = window.setTimeout(() => setIsCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [isCopied]);

  function handleFiles(files) {
    const file = files[0];

    if (!file || !file.name.toLowerCase().endsWith(".json")) {
      setFileError("Selecione apenas arquivos com a extensão .json.");
      return;
    }

    setCurrentFile(file);
    setParsedRows([]);
    setSelectedFields(null);
    setFileError("");
    setIsCopied(false);

    const reader = new FileReader();

    reader.onload = (event) => {
      const content = String(event.target.result ?? "").replace(/^\uFEFF/, "");
      let parsed;

      try {
        parsed = JSON.parse(content);
      } catch (error) {
        setFileError("O arquivo não contém um JSON válido: " + error.message);
        return;
      }

      const rows = normalizeToRows(parsed);

      if (!rows || !rows.length) {
        setFileError(
          "Não foi possível encontrar dados tabuláveis neste JSON.",
        );
        return;
      }

      if (!collectOrderedFields(rows).length) {
        setFileError(
          "O JSON não contém propriedades que possam ser convertidas em colunas.",
        );
        return;
      }

      setParsedRows(rows);
      setSelectedFields(null);
      setFileError("");
    };

    reader.onerror = () => {
      setFileError("Não foi possível ler o arquivo. Tente novamente.");
    };

    reader.readAsText(file, "UTF-8");
  }

  function handleColumnChange(field, checked) {
    setSelectedFields((current) => {
      const currentFields = current === null ? fields : current;

      return checked
        ? [...currentFields, field]
        : currentFields.filter((selectedField) => selectedField !== field);
    });
    setIsCopied(false);
  }

  function handleSelectAll() {
    setSelectedFields(fields);
    setIsCopied(false);
  }

  function handleSelectNone() {
    setSelectedFields([]);
    setIsCopied(false);
  }

  async function handleCopy() {
    if (!generatedCsv) return;

    try {
      await navigator.clipboard.writeText(generatedCsv);
      setIsCopied(true);
      setFileError("");
    } catch {
      setFileError(
        "Não foi possível copiar o CSV automaticamente. Verifique as permissões do navegador.",
      );
    }
  }

  function handleDownload() {
    if (!generatedCsv) return;

    let blob;

    if (encoding === "latin1") {
      blob = new Blob([stringToLatin1Bytes(generatedCsv)], {
        type: "text/csv;charset=iso-8859-1;",
      });
    } else {
      const content =
        encoding === "utf8-bom" ? "\uFEFF" + generatedCsv : generatedCsv;

      blob = new Blob([content], {
        type: "text/csv;charset=utf-8;",
      });
    }

    downloadBlob(blob, "dados_convertidos.csv");
  }

  function handleClear() {
    setCurrentFile(null);
    setParsedRows([]);
    setDelimiter(";");
    setEncoding("utf8-bom");
    setSelectedFields(null);
    setFileError("");
    setIsCopied(false);
  }

  return (
    <div className={styles.converter}>
      <HelpToggle>
        <strong>Como funciona:</strong> envie um arquivo JSON contendo uma
        lista de objetos ou um único objeto. Escolha quais campos serão
        convertidos em colunas, o delimitador e a codificação de saída. O CSV é
        gerado automaticamente e pode ser copiado ou baixado. Valores que forem
        objetos ou listas são convertidos em texto na célula. Todo o
        processamento acontece no navegador; o arquivo não é enviado a um
        servidor.
      </HelpToggle>

      <FileDropzone
        label={currentFile ? currentFile.name : DEFAULT_LABEL}
        ariaLabel="Clique ou arraste um arquivo JSON para enviar"
        accept=".json,application/json"
        onFiles={handleFiles}
      />

      <StatusMessage type="error">{fileError}</StatusMessage>

      {parsedRows.length > 0 && (
        <section
          className={styles.configPanel}
          aria-label="Configurações do CSV"
        >
          <div className={styles.settingsRow}>
            <div className={styles.settingField}>
              <label htmlFor="json-csv-delimiter" className={shared.label}>
                Delimitador de saída
              </label>
              <select
                id="json-csv-delimiter"
                className={shared.input}
                value={delimiter}
                onChange={(event) => {
                  setDelimiter(event.target.value);
                  setIsCopied(false);
                }}
              >
                <option value=";">Ponto e vírgula ( ; )</option>
                <option value=",">Vírgula ( , )</option>
                <option value="\t">Tabulação</option>
              </select>
            </div>

            <div className={styles.settingField}>
              <label htmlFor="json-csv-encoding" className={shared.label}>
                Codificação de saída
              </label>
              <select
                id="json-csv-encoding"
                className={shared.input}
                value={encoding}
                onChange={(event) => setEncoding(event.target.value)}
              >
                <option value="utf8-bom">
                  UTF-8 com BOM (recomendado para abrir no Excel)
                </option>
                <option value="utf8">UTF-8</option>
                <option value="latin1">ISO-8859-1 / Latin1</option>
              </select>
            </div>
          </div>

          <div className={styles.settingBlock}>
            <div className={styles.columnsHeader}>
              <h2 className={styles.sectionTitle}>Colunas a incluir no CSV</h2>
              <div className={styles.selectGroup}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={handleSelectAll}
                >
                  Selecionar todas
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={handleSelectNone}
                >
                  Limpar seleção
                </button>
              </div>
            </div>

            <div className={styles.columnsGrid}>
              {fields.map((field, index) => {
                const label =
                  field && field.trim() ? field : "(coluna " + (index + 1) + ")";
                const id = "json-csv-column-" + index;

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
          </div>
        </section>
      )}

      {parsedRows.length > 0 && (
        <section className={styles.csvContainer} aria-labelledby="csv-title">
          <div className={styles.outputHeader}>
            <h2 id="csv-title" className={styles.sectionTitle}>
              Resultado do CSV
            </h2>
            {generatedCsv && (
              <button
                type="button"
                className={
                  isCopied
                    ? styles.copyButton + " " + styles.copied
                    : styles.copyButton
                }
                onClick={handleCopy}
                aria-label="Copiar conteúdo CSV"
                title="Copiar código"
              >
                <i
                  className={
                    isCopied ? "fas fa-check" : "fas fa-copy"
                  }
                  aria-hidden="true"
                ></i>
                {isCopied ? "Copiado!" : "Copiar"}
              </button>
            )}
          </div>
          <pre className={styles.csvOutput}>
            <code>{outputMessage}</code>
          </pre>
        </section>
      )}

      {generatedCsv && (
        <div className={styles.actions}>
          <Button icon="fa-download" onClick={handleDownload}>
            Baixar CSV
          </Button>
          <Button variant="danger" icon="fa-trash-alt" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      )}

      {currentFile && !generatedCsv && (
        <div className={styles.actions}>
          <Button variant="danger" icon="fa-trash-alt" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}

export default JsonToCsv;
