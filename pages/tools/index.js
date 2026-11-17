// pages/index.js
import Link from "next/link";
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import { tools } from "@/configs/tools.js";
import styles from "./index.module.css";

function Home() {
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

          <ul className={styles.grid}>
            {tools.map((tool) => (
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
