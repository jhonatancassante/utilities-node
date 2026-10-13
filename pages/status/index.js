import Head from "next/head";
import useSWR from "swr";
import styles from "./index.module.css";

async function fetchAPI(key) {
  const response = await fetch(key);
  if (!response.ok) {
    throw new Error("Erro ao carregar dados da API");
  }
  return await response.json();
}

function StatusPage() {
  const { isLoading, data, error } = useSWR("/api/v1/status", fetchAPI, {
    refreshInterval: 5000,
  });
  const isWarning = isLoading;

  const statusIcon = error ? "🔴" : isWarning ? "🟡" : "🟢";
  const statusBadgeText = error
    ? "ERRO NO SISTEMA"
    : isWarning
      ? "CARREGANDO..."
      : "SISTEMA OPERACIONAL";
  const statusBadgeClass = error
    ? styles.badgeError
    : isWarning
      ? styles.badgeWarning
      : styles.badgeSuccess;

  return (
    <>
      <Head>
        <title>Utilities | Status do Sistema</title>
        <meta
          name="description"
          content="Painel de monitoramento do sistema e banco de dados em tempo real."
        />
      </Head>

      <main className={styles.container}>
        <section className={styles.card}>
          <div
            className={`${styles.icon} ${error ? styles.iconError : isWarning ? styles.iconWarning : styles.iconSuccess}`}
            aria-hidden="true"
          >
            {statusIcon}
          </div>

          <div style={{ textAlign: "center" }}>
            <span className={`${styles.badge} ${statusBadgeClass}`}>
              {statusBadgeText}
            </span>
            <h1>Status do Sistema</h1>
          </div>

          <UpdatedAt
            isLoading={isLoading}
            error={error}
            data={data?.updated_at}
          />

          <DatabaseStatus
            isLoading={isLoading}
            error={error}
            data={data?.dependencies?.database}
          />

          <small>Utilities Node.js · Atualização automática a cada 5s</small>
        </section>
      </main>
    </>
  );
}

export default StatusPage;

function UpdatedAt({ isLoading, error, data }) {
  let updatedAtText = "Carregando...";

  if (error) {
    updatedAtText = "Falha ao obter última atualização";
  } else if (!isLoading && data) {
    updatedAtText = new Date(data).toLocaleString("pt-BR");
  }

  return (
    <p className={styles.secondaryText}>
      <strong>Última atualização:</strong> {updatedAtText}
    </p>
  );
}

function DatabaseStatus({ isLoading, error, data }) {
  if (error) {
    return (
      <div className={styles.metricsBoxError}>
        <p>⚠️ Não foi possível conectar ao banco de dados.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.metricsBox}>
        <div className={styles.progress}>
          <div className={styles.progressBar}></div>
        </div>
        <p style={{ textAlign: "center", margin: 0 }}>
          Carregando métricas do banco de dados...
        </p>
      </div>
    );
  }

  const opened = data?.opened_connections ?? 0;
  const max = data?.max_connections ?? 1;
  const usagePercentage = (opened / max) * 100;
  const isHighLoad = usagePercentage > 80;

  return (
    <div className={styles.metricsBox}>
      <div className={styles.metricsBoxTitle}>
        <strong>Database</strong>
      </div>

      <div className={styles.metricRow}>
        <span>
          <span className={styles.tagSuccess}>{"OK"}</span>
          <strong>Versão:</strong>
        </span>
        <span className={styles.valueBadge}>{data?.version ?? "N/A"}</span>
      </div>

      <div className={styles.metricRow}>
        <span>
          <span className={styles.tagSuccess}>{"OK"}</span>
          <strong>Máx. Conexões:</strong>
        </span>
        <span className={styles.valueBadge}>{max}</span>
      </div>

      <div className={styles.metricRow}>
        <span>
          <span className={isHighLoad ? styles.tagWarning : styles.tagSuccess}>
            {isHighLoad ? "CARGA ALTA" : "OK"}
          </span>
          <strong>Conexões Abertas:</strong>
        </span>
        <span
          className={
            isHighLoad ? styles.valueBadgeWarning : styles.valueBadgeSuccess
          }
        >
          {opened}
        </span>
      </div>
    </div>
  );
}
