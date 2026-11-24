// pages/index.js
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import headConfigs from "@/configs/head.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const PROGRESS = 26.5 + 29;

function Home() {
  const progressLabel = `${PROGRESS.toLocaleString("pt-BR")}%`;

  return (
    <>
      <AppHead
        title="Em construção"
        description="Uma nova versão dos meus utilitários de trabalho está sendo construída."
      />

      <Layout title="Utilitários" icon="fa-tools">
        <main className={shared.container}>
          <section className={`${shared.card} ${styles.card}`}>
            <div className={shared.icon} aria-hidden="true">
              🛠️
            </div>

            <span className={shared.badge}>EM CONSTRUÇÃO</span>

            <h1>
              Estamos preparando
              <br />
              algo novo.
            </h1>

            <p>
              O <strong>Utilities</strong> está ganhando uma nova versão,
              construída do zero com tecnologias modernas e muito código.
            </p>

            <p className={styles.secondaryText}>
              Por enquanto, a obra está em andamento. Volte em breve! 🚧
            </p>

            <div
              className={styles.progressWrapper}
              style={{ "--progress-width": `${PROGRESS}%` }}
            >
              <div
                className={styles.progress}
                role="progressbar"
                aria-label="Progresso do desenvolvimento"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={PROGRESS}
              >
                <div className={styles.progressBar}></div>
              </div>

              <span className={styles.progressTooltip} aria-hidden="true">
                {progressLabel}
              </span>
            </div>

            <small>{headConfigs.appName} · Em desenvolvimento</small>
          </section>
        </main>
      </Layout>
    </>
  );
}

export default Home;
