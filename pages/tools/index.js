// pages/index.js
import Link from "next/link";
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import { tools } from "@/configs/tools.js";
import useUser from "@/hooks/use-user.js";
import styles from "./index.module.css";

function Home() {
  const { user } = useUser();
  const visibleTools = tools.filter(
    (tool) =>
      !tool.requiredFeature || user?.features?.includes(tool.requiredFeature),
  );

  return (
    <>
      <AppHead description="Utilitários de apoio ao trabalho: QR Code, PDF, conversores de arquivos e mais." />

      <Layout>
        <main className={styles.main}>
          <section className={styles.intro}>
            <h1>Utilitários</h1>
            <p>
              Ferramentas simples para o trabalho do dia a dia. Escolha uma
              abaixo para começar.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="tools-title">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionEyebrow}>Utilitários</span>
                <h2 id="tools-title">
                  Encontre a ferramenta certa para sua tarefa
                </h2>
              </div>
              <span className={styles.count}>
                {visibleTools.length} ferramentas
              </span>
            </div>

            <ul className={styles.grid}>
              {visibleTools.map((tool) => (
                <li key={tool.slug}>
                  {tool.isAvailable ? (
                    <Link href={tool.href} className={styles.card}>
                      <ToolCardContent tool={tool} />
                    </Link>
                  ) : (
                    <div
                      className={`${styles.card} ${styles.cardSoon}`}
                      aria-disabled="true"
                    >
                      <ToolCardContent tool={tool} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </main>
      </Layout>
    </>
  );
}

function ToolCardContent({ tool }) {
  return (
    <>
      <span className={styles.icon} aria-hidden="true">
        <i className={`fas ${tool.icon}`}></i>
      </span>
      <h2>{tool.title}</h2>
      <p>{tool.description}</p>
      {!tool.isAvailable && <span className={styles.soonTag}>Em breve</span>}
    </>
  );
}

export default Home;
