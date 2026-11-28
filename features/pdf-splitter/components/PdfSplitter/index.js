// features/pdf-splitter/components/PdfSplitter/index.js
import { useState } from "react";
import Button from "@/components/Button";
import FileDropzone from "@/components/FileDropzone";
import HelpToggle from "@/components/HelpToggle";
import StatusMessage from "@/components/StatusMessage";
import WarningList from "@/components/WarningList";
import { downloadBlob } from "@/lib/client/files.js";
import shared from "@/styles/shared.module.css";
import { addPdfFiles, splitPdfFiles, validateRange } from "../../lib/pdf.js";
import styles from "./index.module.css";

const DEFAULT_LABEL =
  "Clique ou arraste seus arquivos PDF aqui (permite múltiplos)";

function getDropzoneLabel(files) {
  if (files.length === 0) {
    return DEFAULT_LABEL;
  }
  if (files.length === 1) {
    return files[0].name;
  }
  return `${files.length} arquivos PDF selecionados`;
}

function PdfSplitter() {
  const [files, setFiles] = useState([]);
  const [pageInit, setPageInit] = useState("1");
  const [pageCount, setPageCount] = useState("4");
  const [status, setStatus] = useState({ type: "info", message: "" });
  const [warnings, setWarnings] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  function handleFiles(incoming) {
    const result = addPdfFiles(files, incoming);

    if (!result.ok) {
      setStatus({ type: "error", message: result.error });
      return;
    }

    setFiles(result.files);
    setStatus({ type: "info", message: "" });
  }

  function handleClear() {
    setFiles([]);
    setWarnings([]);
    setStatus({ type: "info", message: "" });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (files.length === 0) {
      setStatus({
        type: "error",
        message: "Selecione pelo menos um arquivo PDF!",
      });
      return;
    }

    const range = validateRange({ pageInit, pageCount });
    if (!range.ok) {
      setStatus({ type: "error", message: range.error });
      return;
    }

    setIsProcessing(true);
    setWarnings([]);
    setStatus({ type: "info", message: "Processando..." });

    try {
      const result = await splitPdfFiles(files, range.value);

      if (!result.ok) {
        setStatus({ type: "error", message: result.error });
        return;
      }

      downloadBlob(result.blob, result.filename);
      setWarnings(result.warnings);
      setStatus({ type: "success", message: "Download iniciado!" });
    } catch {
      setStatus({
        type: "error",
        message: "Erro ao processar os arquivos. Tente novamente.",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      <HelpToggle>
        <strong>Como funciona:</strong> clique ou arraste seus arquivos PDF para
        enviar (vários arquivos são permitidos). Em seguida, defina a página
        inicial e o número de páginas que deseja extrair de cada PDF. O
        resultado será um arquivo PDF (se você enviar apenas um arquivo) ou um
        ZIP (se enviar vários) contendo os PDFs extraídos. Se um arquivo tiver
        menos páginas que o pedido, serão extraídas as páginas da inicial até a
        última, e ele aparecerá em um aviso; se não chegar à página inicial, ele
        será ignorado. Tudo é processado no seu navegador: os arquivos não são
        enviados a nenhum servidor.
      </HelpToggle>

      <form onSubmit={handleSubmit} noValidate>
        <FileDropzone
          label={getDropzoneLabel(files)}
          ariaLabel="Clique ou arraste seus arquivos PDF para enviar, múltiplos arquivos permitidos"
          accept=".pdf,application/pdf"
          multiple
          onFiles={handleFiles}
        />

        <div className={styles.fields}>
          <div>
            <label htmlFor="pdf-page-init" className={shared.label}>
              Página inicial:
            </label>
            <input
              id="pdf-page-init"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={pageInit}
              onChange={(event) => setPageInit(event.target.value)}
              className={`${shared.input} ${styles.number}`}
            />
          </div>

          <div>
            <label htmlFor="pdf-page-count" className={shared.label}>
              Número de páginas:
            </label>
            <input
              id="pdf-page-count"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={pageCount}
              onChange={(event) => setPageCount(event.target.value)}
              className={`${shared.input} ${styles.number}`}
            />
          </div>
        </div>

        {files.length > 0 && (
          <div className={styles.actions}>
            <Button type="submit" icon="fa-download" disabled={isProcessing}>
              {isProcessing ? "Processando..." : "Baixar PDFs"}
            </Button>
            <Button
              variant="danger"
              icon="fa-trash-alt"
              onClick={handleClear}
              disabled={isProcessing}
            >
              Limpar
            </Button>
          </div>
        )}
      </form>

      <StatusMessage type={status.type}>{status.message}</StatusMessage>

      <WarningList
        title={
          warnings.length === 1
            ? "1 arquivo tem menos páginas que o intervalo pedido:"
            : `${warnings.length} arquivos têm menos páginas que o intervalo pedido:`
        }
        items={warnings}
      />
    </div>
  );
}

export default PdfSplitter;
