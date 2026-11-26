import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import AdminDataTable from "@/components/AdminDataTable";
import AdminPagination from "@/components/AdminPagination";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import {
  hasAdminAccess,
  hasAdminSectionAccess,
} from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function CertificatesPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [feedback, setFeedback] = useState(null);

  const canCreate = user?.features?.includes("create:certificate");
  const canUpdateOwn = user?.features?.includes("update:certificate");
  const canUpdateOthers = user?.features?.includes("update:certificate:others");

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      setRecords(await requestAPI("/api/v1/certificates"));
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (
      !isLoading &&
      user &&
      !hasAdminSectionAccess(user, "certificates")
    ) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, router, user]);

  useEffect(() => {
    if (user && hasAdminSectionAccess(user, "certificates")) {
      Promise.resolve().then(loadRecords);
    }
  }, [loadRecords, user]);

  const availableYears = useMemo(
    () =>
      Array.from(new Set(records.map((record) => Number(record.year))))
        .filter(Number.isInteger)
        .sort((first, second) => second - first),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesYear =
        yearFilter === "all" || String(record.year) === yearFilter;
      const matchesSearch =
        !term ||
        [
          record.protocol_number,
          record.protocol_year,
          record.applicant_name,
          record.physical_property_id,
          record.physical_registration,
          record.owner_name,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        );
      return matchesYear && matchesSearch;
    });
  }, [records, search, yearFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Certidões" />
        <Layout>
          <main className={shared.container}>
            <section className={shared.card}>
              <p>Carregando permissões...</p>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AppHead title="Certidões" />
        <Layout>
          <main className={shared.container}>
            <section className={shared.card}>
              <StatusMessage
                type="critical"
                name={error.name}
                action={error.action}
              >
                {error.message}
              </StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (!user || !hasAdminSectionAccess(user, "certificates")) return null;

  const columns = [
    { key: "protocol_number", label: "Protocolo" },
    { key: "protocol_year", label: "Ano protocolo" },
    { key: "applicant_name", label: "Requerente" },
    { key: "physical_property_id", label: "Código físico" },
    { key: "year", label: "Exercício" },
    {
      key: "total_value",
      label: "Valor venal",
      render: (record) =>
        Number(record.total_value).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
    },
    {
      key: "created_at",
      label: "Emissão",
      render: (record) => formatDate(record.created_at),
    },
  ];

  return (
    <>
      <AppHead
        title="Certidões"
        description="Consulte e emita certidões de valor venal."
      />
      <Layout>
        <main className={shared.container + " " + shared.containerUltraWide}>
          <section
            className={
              shared.card + " " + shared.cardUltraWide + " " + styles.card
            }
          >
            <AdminBackButton />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-file-alt"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>Certidões</h1>
              <p>
                Consulte as certidões emitidas e faça novas emissões com cálculo
                automático dos valores venais.
              </p>
            </header>
            {feedback && (
              <div className={styles.feedback}>
                <StatusMessage
                  type="inline-error"
                  name={feedback.name}
                  action={feedback.action}
                >
                  {feedback.message}
                </StatusMessage>
              </div>
            )}
            <div className={styles.toolbar}>
              <label className={styles.searchField}>
                <span className={shared.label}>Pesquisar certidões</span>
                <input
                  className={shared.input}
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Protocolo, requerente, imóvel ou inscrição..."
                />
              </label>
              <label className={styles.yearField}>
                <span className={shared.label}>Exercício</span>
                <select
                  className={shared.input}
                  value={yearFilter}
                  onChange={(event) => {
                    setYearFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              {canCreate && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => router.push("/admin/certificates/new")}
                >
                  <i className="fas fa-plus" aria-hidden="true"></i>
                  Nova certidão
                </button>
              )}
            </div>
            <section className={styles.results}>
              <div className={styles.resultsHeading}>
                <div>
                  <h2>Certidões emitidas</h2>
                  <span>{filteredRecords.length} registro(s)</span>
                </div>
              </div>
              {isLoadingRecords ? (
                <p className={styles.empty}>Carregando certidões...</p>
              ) : filteredRecords.length === 0 ? (
                <p className={styles.empty}>Nenhuma certidão encontrada.</p>
              ) : (
                <>
                  <AdminDataTable
                    records={visibleRecords}
                    columns={columns}
                    renderActions={(record, actionClassName) => {
                      const canEdit =
                        canUpdateOthers ||
                        (canUpdateOwn && record.user_id === user.id);
                      return (
                        <button
                          type="button"
                          className={actionClassName}
                          onClick={() =>
                            router.push(
                              "/admin/certificates/" +
                                encodeURIComponent(record.id),
                            )
                          }
                        >
                          <i
                            className={
                              "fas " + (canEdit ? "fa-edit" : "fa-eye")
                            }
                            aria-hidden="true"
                          ></i>{" "}
                          {canEdit ? "Editar" : "Visualizar"}
                        </button>
                      );
                    }}
                  />
                  <AdminPagination
                    page={page}
                    setPage={setPage}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    pageCount={pageCount}
                    currentPage={currentPage}
                  />
                </>
              )}
            </section>
          </section>
        </main>
      </Layout>
    </>
  );
}

export default CertificatesPage;
