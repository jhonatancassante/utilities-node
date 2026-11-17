// pages/diario-oficial/edicao-0012026/index.js
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import styles from "./index.module.css";

const PDF_URL =
  "/diario-oficial/edicao-0012026/diario-oficila-edicao-0012026.pdf";

function DiarioOficialPage() {
  return (
    <>
      <AppHead
        title="Diário Oficial · Edição 001/2026"
        description="Consulte a edição 001/2026 do Diário Oficial."
      />

      <Layout>
        <main className={styles.container}>
          <section className={styles.card} aria-labelledby="page-title">
            <div className={styles.heading}>
              <div>
                <span className={styles.eyebrow}>PUBLICAÇÕES OFICIAIS</span>
                <h1 id="page-title">Diário Oficial</h1>
                <p className={styles.subtitle}>Edição nº 001/2026</p>
              </div>

              <a
                className={styles.downloadButton}
                href={PDF_URL}
                download="diario-oficila-edicao-0012026.pdf"
              >
                <i className="fas fa-download" aria-hidden="true"></i>
                <span>Baixar PDF</span>
              </a>
            </div>

            <div className={styles.viewer}>
              <iframe
                src={`${PDF_URL}#toolbar=1&navpanes=1&scrollbar=1`}
                title="Leitor do Diário Oficial — Edição 001/2026"
                className={styles.pdfFrame}
              />
            </div>

            <p className={styles.helpText}>
              Utilize os controles do leitor para navegar pelas páginas,
              ajustar o zoom ou imprimir o documento.
            </p>
          </section>
        </main>
      </Layout>
    </>
  );
}

export default DiarioOficialPage;
