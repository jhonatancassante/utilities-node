import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHead from "@/components/AppHead";
import AdminBackButton from "@/components/AdminBackButton";
import Button from "@/components/Button";
import AdminDataTable from "@/components/AdminDataTable";
import AdminPagination from "@/components/AdminPagination";
import Layout from "@/components/Layout";
import RealEstatePropertyBulkModal from "@/components/RealEstatePropertyBulkModal";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import {
  hasAdminAccess,
  hasAdminSectionAccess,
} from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const TABLE_FIELDS = [
  ["physical_property_id", "IdFisico"],
  ["physical_registration", "InscrFisico"],
  ["ctm", "Ctm"],
  ["ctm_count", "CtmCount"],
  ["grouping", "Englobamento"],
  ["property_block", "ImovelQuadra"],
  ["property_lots", "ImovelLotes"],
  ["land_area", "AreaTerreno"],
  ["built_area", "AreaEdificada"],
  ["property_neighborhood", "ImovelBairro"],
  ["owner_name", "Proprietario"],
  ["promissory_buyer", "Compromissario"],
  ["land_sector", "SetorTerreno"],
  ["property_street", "ImovelLogradouro"],
  ["property_number", "ImovelNumero"],
  ["property_complement", "ImovelComplemento"],
  ["construction_type", "TipoConstr"],
  ["ideal_fraction", "FracaoIdeal"],
  ["points", "Pontos"],
];

function RealEstatePropertiesPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(
    String(new Date().getFullYear()),
  );
  const [updatedFilter, setUpdatedFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [feedback, setFeedback] = useState(null);
  const [dialog, setDialog] = useState(null);
  const canCreate = user?.features?.includes("create:real_estate_properties");
  const canUpdate = user?.features?.includes("update:real_estate_properties");
  const canDelete = user?.features?.includes("delete:real_estate_properties");

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      const data = await requestAPI("/api/v1/admin/real-estate-properties");
      setRecords(data);
      setSelectedIds([]);
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
    if (user && hasAdminSectionAccess(user, "real-estate-properties")) {
      Promise.resolve().then(loadRecords);
    }
  }, [loadRecords, user]);

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
      !hasAdminSectionAccess(user, "real-estate-properties")
    ) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, router, user]);

  const availableYears = useMemo(
    () =>
      Array.from(new Set(records.map((record) => Number(record.year))))
        .filter((year) => Number.isInteger(year))
        .sort((first, second) => second - first),
    [records],
  );
  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesYear = String(record.year) === yearFilter;
      const matchesUpdated = Boolean(record.annual) !== updatedFilter;
      const matchesSearch =
        !term ||
        [
          record.id,
          record.physical_property_id,
          record.physical_registration,
          record.ctm,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        );
      return matchesYear && matchesUpdated && matchesSearch;
    });
  }, [records, search, yearFilter, updatedFilter]);
  const pageCount =
    pageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords =
    pageSize === "all"
      ? filteredRecords
      : filteredRecords.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize,
        );
  const allVisibleSelected =
    visibleRecords.length > 0 &&
    visibleRecords.every((record) => selectedIds.includes(record.id));

  function toggleSelection(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function togglePageSelection(checked) {
    const visibleIds = visibleRecords.map((record) => record.id);
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, ...visibleIds]))
        : current.filter((id) => !visibleIds.includes(id)),
    );
  }

  async function handleBulkImport(records) {
    setIsSaving(true);
    setFeedback(null);
    try {
      const request = (overwriteExisting = false) =>
        requestAPI("/api/v1/admin/real-estate-properties/bulk", {
          method: "POST",
          body: JSON.stringify({ records, overwriteExisting }),
        });

      try {
        await request();
      } catch (requestError) {
        if (
          requestError.statusCode !== 409 ||
          !records.every((record) => record.annual === true)
        ) {
          throw requestError;
        }
        return await new Promise((resolve) => {
          setDialog({
            type: "bulk-import",
            records,
            resolve,
            message:
              requestError.message +
              "\n\nDeseja continuar com a atualização dos registros existentes?",
          });
        });
      }

      await loadRecords();
      setFeedback({
        type: "success",
        message: records.length + " imóvel(is) importado(s) com sucesso.",
      });
      return true;
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }
  async function handleDelete(ids) {
    if (!ids.length) return;
    setDialog({
      type: "delete",
      ids,
      message: "Deseja excluir " + ids.length + " imóvel(is) selecionado(s)?",
    });
  }

  async function confirmDialog() {
    const currentDialog = dialog;
    if (!currentDialog) return;
    setDialog(null);

    if (currentDialog.type === "bulk-import") {
      setFeedback(null);
      try {
        await requestAPI("/api/v1/admin/real-estate-properties/bulk", {
          method: "POST",
          body: JSON.stringify({
            records: currentDialog.records,
            overwriteExisting: true,
          }),
        });
        await loadRecords();
        setFeedback({
          type: "success",
          message:
            currentDialog.records.length +
            " imóvel(is) importado(s) com sucesso.",
        });
        currentDialog.resolve(true);
      } catch (requestError) {
        setFeedback({
          type: "error",
          name: requestError.name,
          message: requestError.message,
          action: requestError.action,
        });
        currentDialog.resolve(false);
      }
      return;
    }

    if (currentDialog.type !== "delete") return;
    const ids = currentDialog.ids;
    setIsDeleting(true);
    setFeedback(null);
    try {
      if (ids.length === 1) {
        await requestAPI(
          "/api/v1/admin/real-estate-properties/" + encodeURIComponent(ids[0]),
          { method: "DELETE" },
        );
      } else {
        await requestAPI("/api/v1/admin/real-estate-properties/bulk", {
          method: "DELETE",
          body: JSON.stringify({ ids }),
        });
      }
      await loadRecords();
      setFeedback({
        type: "success",
        message: ids.length + " imóvel(is) excluído(s) com sucesso.",
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

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Imóveis" />
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
        <AppHead title="Imóveis" />
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
  if (!user || !hasAdminSectionAccess(user, "real-estate-properties"))
    return null;

  return (
    <>
      <AppHead
        title="Imóveis"
        description="Gerencie os dados cadastrais dos imóveis."
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
                <i className="fas fa-home"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>Imóveis</h1>
              <p>
                Consulte, cadastre e mantenha os dados cadastrais dos imóveis
                utilizados na emissão das certidões de valor venal.
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
            {canCreate && (
              <RealEstatePropertyBulkModal
                isSaving={isSaving}
                onSubmit={handleBulkImport}
              />
            )}
            <div className={styles.toolbar}>
              <div className={styles.toolbarFilters}>
                <label className={styles.searchField}>
                  <span className={shared.label}>
                    Pesquisar por ID ou cadastro
                  </span>
                  <input
                    className={shared.input}
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="ID, inscrição física ou CTM..."
                  />
                </label>
                <label className={styles.filterField}>
                  <span className={shared.label}>Ano</span>
                  <select
                    className={shared.input}
                    value={yearFilter}
                    onChange={(event) => {
                      setYearFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    {!availableYears.includes(Number(yearFilter)) && (
                      <option value={yearFilter}>{yearFilter}</option>
                    )}
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.switchField}>
                  <span className={shared.label}>Atualizado</span>
                  <span className={styles.switchControl}>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={updatedFilter}
                      onChange={(event) => {
                        setUpdatedFilter(event.target.checked);
                        setPage(1);
                      }}
                    />
                    <span aria-hidden="true"></span>
                  </span>
                </label>
              </div>
              {canCreate && (
                <div className={styles.toolbarActions}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() =>
                      router.push("/admin/real-estate-properties/new")
                    }
                  >
                    <i className="fas fa-plus" aria-hidden="true"></i> Novo
                    imóvel
                  </button>
                </div>
              )}
            </div>
            <section className={styles.results}>
              <div className={styles.resultsHeading}>
                <div>
                  <h2>Imóveis cadastrados</h2>
                  <span>{filteredRecords.length} registro(s)</span>
                </div>
                {canDelete && selectedIds.length > 0 && (
                  <Button
                    type="button"
                    variant="danger"
                    icon="fa-trash"
                    onClick={() => handleDelete(selectedIds)}
                    disabled={isDeleting}
                  >
                    {isDeleting
                      ? "Excluindo..."
                      : "Excluir selecionados (" + selectedIds.length + ")"}
                  </Button>
                )}
              </div>
              {isLoadingRecords ? (
                <p className={styles.empty}>Carregando imóveis...</p>
              ) : filteredRecords.length === 0 ? (
                <p className={styles.empty}>Nenhum imóvel encontrado.</p>
              ) : (
                <>
                  <AdminDataTable
                    records={visibleRecords}
                    columns={TABLE_FIELDS.map(([key, label]) => ({
                      key,
                      label,
                    }))}
                    selectable={canDelete}
                    selectedIds={selectedIds}
                    allVisibleSelected={allVisibleSelected}
                    onToggleRecord={toggleSelection}
                    onTogglePage={togglePageSelection}
                    getSelectionLabel={(record) =>
                      "Selecionar imóvel " + record.physical_registration
                    }
                    renderActions={(record, actionClassName) => (
                      <button
                        type="button"
                        className={actionClassName}
                        onClick={() =>
                          router.push(
                            "/admin/real-estate-properties/" +
                              encodeURIComponent(record.id),
                          )
                        }
                      >
                        <i
                          className={
                            "fas " + (canUpdate ? "fa-edit" : "fa-eye")
                          }
                          aria-hidden="true"
                        ></i>{" "}
                        {canUpdate ? "Editar" : "Visualizar"}
                      </button>
                    )}
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
      {dialog && (
        <StatusMessage
          type="confirmation"
          resetKey={dialog.type + "-" + (dialog.ids?.join(",") || "bulk")}
          onConfirm={confirmDialog}
          onCancel={() => {
            dialog.resolve?.(false);
            setDialog(null);
          }}
        >
          {dialog.message}
        </StatusMessage>
      )}
    </>
  );
}

export default RealEstatePropertiesPage;
