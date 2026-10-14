// pages/index.js
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import siteConfigs from "@/configs/site.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function Home() {
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

            <div className={styles.progress}>
              <div className={styles.progressBar}></div>
            </div>

            <small>{siteConfigs.appName} · Em desenvolvimento</small>
          </section>
        </main>
      </Layout>
    </>
  );
}

export default Home;
