// features/pdf-merger/components/PdfMerger/index.js
import { useState } from "react";
import Button from "@/components/Button";
import FileDropzone from "@/components/FileDropzone";
import HelpToggle from "@/components/HelpToggle";
import StatusMessage from "@/components/StatusMessage";
import { downloadBlob } from "@/lib/client/files.js";
import { addPdfFiles, mergePdfFiles } from "../../lib/pdf.js";
import styles from "./index.module.css";

const DEFAULT_LABEL =
  "Clique ou arraste seus arquivos PDF aqui (múltiplos arquivos)";

function getDropzoneLabel(files) {
  if (files.length === 0) {
    return DEFAULT_LABEL;
  }
  if (files.length === 1) {
    return files[0].name;
  }
  return `${files.length} arquivos PDF selecionados`;
}

function PdfMerger() {
  const [files, setFiles] = useState([]);
  const [addBlankPage, setAddBlankPage] = useState(true);
  const [status, setStatus] = useState({ type: "info", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  function handleFiles(incoming) {
    const result = addPdfFiles(files, incoming);

    if (!result.ok) {
      setStatus({ type: "error", message: result.error });
      return;
    }

    setFiles(result.files);

    if (result.files.length < 2) {
      setStatus({
        type: "info",
        message: "Aviso: selecione pelo menos 2 arquivos PDF para unificar.",
      });
      return;
    }

    setStatus({ type: "info", message: "" });
  }

  function handleClear() {
    setFiles([]);
    setAddBlankPage(true);
    setStatus({ type: "info", message: "" });
  }

  async function handleMerge() {
    if (files.length < 2) {
      setStatus({
        type: "error",
        message: "Selecione pelo menos dois arquivos PDF!",
      });
      return;
    }

    setIsProcessing(true);
    setStatus({
      type: "info",
      message: "Processando e unificando PDFs...",
    });

    try {
      const result = await mergePdfFiles(files, addBlankPage);

      if (!result.ok) {
        setStatus({ type: "error", message: result.error });
        return;
      }

      const blob = new Blob([result.bytes], { type: "application/pdf" });
      downloadBlob(blob, result.filename);
      setStatus({
        type: "success",
        message: `PDF unificado gerado com sucesso: ${result.filename}`,
      });
    } catch {
      setStatus({
        type: "error",
        message:
          "Ocorreu um erro ao unificar os PDFs. Verifique os arquivos e tente novamente.",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      <HelpToggle>
        <strong>Como funciona:</strong> clique ou arraste seus arquivos PDF para
        enviar. Os arquivos serão ordenados alfabeticamente pelo nome. Por
        padrão, PDFs com número ímpar de páginas recebem uma página em branco ao
        final para manter a paridade. Você pode desativar essa opção antes de
        unificar. Tudo é processado no seu navegador: os arquivos não são
        enviados a nenhum servidor.
      </HelpToggle>

      <FileDropzone
        label={getDropzoneLabel(files)}
        ariaLabel="Clique ou arraste seus arquivos PDF para enviar, múltiplos arquivos permitidos"
        accept=".pdf,application/pdf"
        multiple
        onFiles={handleFiles}
      />

      {files.length >= 2 && (
        <>
          <div className={styles.options}>
            <label className={styles.switchRow} htmlFor="pdf-blank-page">
              <span className={styles.switchText}>
                Colocar página em branco?
              </span>
              <span className={styles.switch}>
                <input
                  id="pdf-blank-page"
                  type="checkbox"
                  role="switch"
                  checked={addBlankPage}
                  aria-checked={addBlankPage}
                  onChange={(event) => setAddBlankPage(event.target.checked)}
                  disabled={isProcessing}
                />
                <span className={styles.slider} aria-hidden="true"></span>
              </span>
              <span className={styles.switchState}>
                {addBlankPage ? "Sim" : "Não"}
              </span>
            </label>
          </div>

          <div className={styles.actions}>
            <Button
              type="button"
              icon="fa-object-group"
              onClick={handleMerge}
              disabled={isProcessing}
            >
              {isProcessing ? "Unificando..." : "Unificar e Baixar PDF"}
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
        </>
      )}

      {files.length === 1 && (
        <div className={styles.actions}>
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

      <StatusMessage type={status.type}>{status.message}</StatusMessage>
    </div>
  );
}

export default PdfMerger;
