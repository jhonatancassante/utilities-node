import useSWR from "swr";
import AppHead from "@/components/AppHead";
import siteConfigs from "@/configs/site.js";
import shared from "@/styles/shared.module.css";
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
      <AppHead
        title="Status do Sistema"
        description="Painel de monitoramento do sistema e banco de dados em tempo real."
      />

      <main className={shared.container}>
        <section className={`${shared.card} ${styles.card}`}>
          <div style={{ textAlign: "center" }}>
            <h1>Status do Sistema</h1>
            <span className={`${shared.badge} ${statusBadgeClass}`}>
              {statusBadgeText}
            </span>
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

          <small>
            {siteConfigs.appName} · Atualização automática a cada 5s
          </small>
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

const STATUS = {
  success: {
    tag: styles.tagSuccess,
    badge: styles.valueBadgeSuccess,
    label: "OK",
  },
  warning: {
    tag: styles.tagWarning,
    badge: styles.valueBadgeWarning,
    label: "CARGA ALTA",
  },
  error: {
    tag: styles.tagError,
    badge: styles.valueBadgeError,
    label: "ERROR",
  },
};

const hasValue = (value) => value !== null && value !== undefined;

function MetricRow({ title, value, isWarning = false }) {
  const status = !hasValue(value) ? "error" : isWarning ? "warning" : "success";
  const { tag, badge, label } = STATUS[status];

  return (
    <div className={styles.metricRow}>
      <span>
        <span className={tag}>{label}</span>
        <strong>{title}</strong>
      </span>
      <span className={`${styles.valueBadge} ${badge}`}>
        {hasValue(value) ? value : "N/A"}
      </span>
    </div>
  );
}

function DatabaseStatus({ isLoading, error, data }) {
  const {
    version,
    max_connections: max,
    opened_connections: opened,
  } = data ?? {};
  const isHighLoad = hasValue(opened) && hasValue(max) && opened / max > 0.8;

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

  return (
    <div className={styles.metricsBox}>
      <div className={styles.metricsBoxTitle}>
        <strong>Database</strong>
      </div>

      <MetricRow title="Versão" value={version} />
      <MetricRow title="Máximo de Conexões" value={max} />
      <MetricRow
        title="Conexões Abertas"
        value={opened}
        isWarning={isHighLoad}
      />
    </div>
  );
}
