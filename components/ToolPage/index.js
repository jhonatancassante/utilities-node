// components/ToolPage/index.js
// Estrutura comum de toda página de ferramenta: <head>, Layout, título e
// descrição vindos do registro em configs/tools.js.
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import { getToolBySlug } from "@/configs/tools.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function ToolPage({ slug, children, wide = false }) {
  const tool = getToolBySlug(slug);

  return (
    <>
      <AppHead title={tool.title} description={tool.description} />

      <Layout>
        <main className={shared.container}>
          <section className={`${shared.card} ${styles.card} ${wide ? styles.wide : ""}`}>
            <header className={styles.heading}>
              <span className={styles.icon} aria-hidden="true">
                <i className={`fas ${tool.icon}`}></i>
              </span>
              <h1>{tool.title}</h1>
              <p>{tool.description}</p>
            </header>

            {children}
          </section>
        </main>
      </Layout>
    </>
  );
}

export default ToolPage;
