import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import DataTable from "@/components/DataTable";
import usePagination from "@/hooks/use-pagination.js";
import useRowSelection from "@/hooks/use-row-selection.js";
import useSortableData from "@/hooks/use-sortable-data.js";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import TableSection from "@/components/TableSection";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import { downloadCertificatePdf } from "@/lib/client/generate-certificate-pdf.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function formatDate(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString("pt-BR");
}

function CertificatesPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [feedback, setFeedback] = useState(null);
  const selection = useRowSelection();
  const clearSelection = selection.clear;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [dialog, setDialog] = useState(null);

  const canRead = user?.features?.includes("read:certificate");
  const canCreate = user?.features?.includes("create:certificate");
  const canUpdateOwn = user?.features?.includes("update:certificate");
  const canUpdateOthers = user?.features?.includes("update:certificate:others");
  const canDelete = user?.features?.includes("delete:certificate");

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      setRecords(await requestAPI("/api/v1/certificates"));
      clearSelection();
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
  }, [clearSelection]);

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (!isLoading && user && !canRead) {
      router.replace("/tools");
    }
  }, [canRead, error, isLoading, router, user]);

  useEffect(() => {
    if (user && canRead) {
      Promise.resolve().then(loadRecords);
    }
  }, [canRead, loadRecords, user]);

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

  const sort = useSortableData(filteredRecords);
  const pagination = usePagination(sort.sortedRecords);

  function handleDelete(ids) {
    if (!ids.length || !canDelete) {
      return;
    }
    setDialog({
      ids,
      message:
        "Deseja excluir " +
        ids.length +
        " certidão(ões) selecionada(s)? A exclusão será lógica.",
    });
  }

  async function confirmDelete() {
    if (!dialog || !canDelete) {
      return;
    }
    const ids = dialog.ids;
    setDialog(null);
    setIsDeleting(true);
    setFeedback(null);
    try {
      if (ids.length === 1) {
        await requestAPI("/api/v1/certificates/" + encodeURIComponent(ids[0]), {
          method: "DELETE",
        });
      } else {
        await requestAPI("/api/v1/certificates/bulk", {
          method: "DELETE",
          body: JSON.stringify({ ids }),
        });
      }
      await loadRecords();
      setFeedback({
        type: "success",
        message: ids.length + " certidão(ões) excluída(s) com sucesso.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handlePrint() {
    if (!selection.selectedIds.length || isGeneratingPdf) {
      return;
    }
    setIsGeneratingPdf(true);
    setFeedback(null);
    try {
      const selectedRecords = records.filter((record) =>
        selection.selectedIds.includes(record.id),
      );
      await downloadCertificatePdf(selectedRecords);
      setFeedback({
        type: "success",
        message:
          selectedRecords.length === 1
            ? "PDF da certidão gerado e baixado com sucesso."
            : "PDF com " +
              selectedRecords.length +
              " certidões gerado e baixado com sucesso.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message:
          requestError.message || "Não foi possível gerar o PDF das certidões.",
        action:
          "Tente novamente. Se o problema persistir, atualize a página e tente novamente.",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Certidão de Valor Venal" />
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

  if (!user || !canRead) {
    return null;
  }

  const columns = [
    { key: "protocol_number", label: "Protocolo" },
    { key: "protocol_year", label: "Ano protocolo" },
    { key: "applicant_name", label: "Requerente" },
    { key: "purpose", label: "Finalidade" },
    { key: "physical_property_id", label: "Código físico" },
    { key: "physical_registration", label: "Inscrição física" },
    { key: "year", label: "Exercício" },
    { key: "owner_name", label: "Proprietário" },
    { key: "promissory_buyer", label: "Compromissário" },
    { key: "owner_rg", label: "RG proprietário" },
    { key: "property_street", label: "Logradouro" },
    { key: "property_number", label: "Número" },
    { key: "property_neighborhood", label: "Bairro" },
    { key: "property_block", label: "Quadra" },
    { key: "property_lots", label: "Lote(s)" },
    { key: "property_complement", label: "Complemento" },
    {
      key: "land_area",
      label: "Área do terreno",
      render: (record) =>
        Number(record.land_area).toLocaleString("pt-BR") + " m²",
    },
    {
      key: "built_area",
      label: "Área construída",
      render: (record) =>
        Number(record.built_area).toLocaleString("pt-BR") + " m²",
    },
    ...["land_value", "building_value", "total_value"].map((key) => ({
      key,
      label:
        key === "land_value"
          ? "Valor venal do terreno"
          : key === "building_value"
            ? "Valor venal da edificação"
            : "Valor venal total",
      render: (record) =>
        Number(record[key]).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
    })),
    { key: "observations", label: "Observações" },
    {
      key: "validity_days",
      label: "Validade",
      render: (record) => record.validity_days + " dias",
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
        title="Certidão de Valor Venal"
        description="Consulte e emita certidões de valor venal."
      />
      <Layout>
        <main className={shared.container + " " + shared.containerUltraWide}>
          <section
            className={
              shared.card + " " + shared.cardUltraWide + " " + styles.card
            }
          >
            <AdminBackButton href="/tools" label="Voltar às ferramentas" />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-file-alt"></i>
              </div>
              <h1>Certidão de Valor Venal</h1>
              <p>
                Consulte as certidões emitidas e faça novas emissões com cálculo
                automático dos valores venais.
              </p>
            </header>
            {feedback && (
              <div className={styles.feedback}>
                <StatusMessage
                  type={
                    feedback.type === "success" ? "success" : "inline-error"
                  }
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
                    pagination.resetPage();
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
                    pagination.resetPage();
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
                  onClick={() => router.push("/tools/certificates/new")}
                >
                  <i className="fas fa-plus" aria-hidden="true"></i>
                  Nova certidão
                </button>
              )}
            </div>
            <TableSection
              title="Certidões emitidas"
              countLabel={filteredRecords.length + " certidão(ões)"}
              actions={
                <>
                  {canDelete && selection.selectedIds.length > 0 && (
                    <Button
                      type="button"
                      variant="danger"
                      icon="fa-trash"
                      onClick={() => handleDelete(selection.selectedIds)}
                      disabled={isDeleting}
                    >
                      {isDeleting
                        ? "Excluindo..."
                        : "Excluir selecionadas (" +
                          selection.selectedIds.length +
                          ")"}
                    </Button>
                  )}
                  {selection.selectedIds.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      icon="fa-print"
                      onClick={handlePrint}
                      disabled={isGeneratingPdf}
                    >
                      {isGeneratingPdf
                        ? "Gerando PDF..."
                        : "Baixar PDF (" + selection.selectedIds.length + ")"}
                    </Button>
                  )}
                </>
              }
            >
              <DataTable
                records={pagination.visibleRecords}
                loading={isLoadingRecords}
                loadingMessage="Carregando certidões..."
                emptyMessage="Nenhuma certidão encontrada."
                columns={columns}
                sort={sort}
                pagination={pagination}
                caption="Certidões emitidas"
                selection={selection}
                getSelectionLabel={(record) =>
                  "Selecionar certidão " +
                  (record.protocol_number
                    ? record.protocol_number + "/" + record.protocol_year
                    : record.id)
                }
                onRowClick={(record) =>
                  router.push(
                    "/tools/certificates/" +
                      encodeURIComponent(record.id) +
                      "?mode=view",
                  )
                }
                renderActions={(record) => {
                  const canEdit =
                    canUpdateOthers ||
                    (canUpdateOwn && record.user_id === user.id);
                  return (
                    <DataTable.RowAction
                      href={
                        "/tools/certificates/" +
                        encodeURIComponent(record.id) +
                        (canEdit ? "" : "?mode=view")
                      }
                      editable={canEdit}
                    />
                  );
                }}
              />
            </TableSection>
          </section>
        </main>
      </Layout>
      {dialog && (
        <StatusMessage
          type="confirmation"
          resetKey={"delete-certificates-" + dialog.ids.join(",")}
          onConfirm={confirmDelete}
          onCancel={() => setDialog(null)}
        >
          {dialog.message}
        </StatusMessage>
      )}
    </>
  );
}

export default CertificatesPage;
