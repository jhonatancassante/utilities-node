import Link from "next/link";

import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import { entertainmentApps } from "@/configs/entertainment.js";
import styles from "./index.module.css";

function EntertainmentPage() {
  return (
    <>
      <AppHead
        title="Entretenimento"
        description="Jogos, experiências e ferramentas para criar, explorar e se divertir."
      />

      <Layout>
        <main className={styles.main}>
          <section className={styles.hero}>
            <span className={styles.eyebrow}>
              <i className="fas fa-dice-d20" aria-hidden="true"></i>
              Um intervalo na rotina
            </span>
            <h1>Entretenimento</h1>
            <p>
              Nem toda ferramenta precisa resolver um problema do trabalho.
              Algumas existem para despertar ideias, contar histórias e
              simplesmente tornar o dia mais divertido.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="apps-title">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionEyebrow}>Experiências</span>
                <h2 id="apps-title">Escolha sua próxima aventura</h2>
              </div>
              <span className={styles.count}>
                {entertainmentApps.length} aplicação
              </span>
            </div>

            <ul className={styles.grid}>
              {entertainmentApps.map((app) => (
                <li key={app.slug}>
                  <Link href={app.href} className={styles.card}>
                    <span className={styles.cardIcon} aria-hidden="true">
                      <i className={`fas ${app.icon}`}></i>
                    </span>
                    <span className={styles.cardEyebrow}>
                      Magic: The Gathering
                    </span>
                    <h3>{app.title}</h3>
                    <p>{app.description}</p>
                    <span className={styles.cardAction}>
                      Explorar aplicação
                      <i className="fas fa-arrow-right" aria-hidden="true"></i>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </Layout>
    </>
  );
}

export default EntertainmentPage;
