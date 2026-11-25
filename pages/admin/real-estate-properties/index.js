import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHead from "@/components/AppHead";
import AdminBackButton from "@/components/AdminBackButton";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import RealEstatePropertyModal from "@/components/RealEstatePropertyModal";
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

const PAGE_SIZES = [10, 20, 50, 100];
const TABLE_FIELDS = [
  ["physical_registration", "Inscrição física"],
  ["ctm", "CTM"],
  ["owner_name", "Proprietário"],
  ["property_street", "Logradouro"],
  ["property_number", "Número"],
  ["property_neighborhood", "Bairro"],
  ["land_area", "Área do terreno"],
  ["built_area", "Área construída"],
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
  const [modalRecord, setModalRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
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

  function togglePageSelection(checked) {
    const visibleIds = visibleRecords.map((record) => record.id);
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, ...visibleIds]))
        : current.filter((id) => !visibleIds.includes(id)),
    );
  }

  async function handleSave(payload) {
    setIsSaving(true);
    setFeedback(null);
    try {
      const isEditing = Boolean(modalRecord?.id);
      await requestAPI(
        isEditing
          ? "/api/v1/admin/real-estate-properties/" +
              encodeURIComponent(modalRecord.id)
          : "/api/v1/admin/real-estate-properties",
        { method: isEditing ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      setIsModalOpen(false);
      setModalRecord(null);
      await loadRecords();
      setFeedback({
        type: "success",
        message: isEditing
          ? "Imóvel atualizado com sucesso."
          : "Imóvel cadastrado com sucesso.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkImport(records) {
    setIsSaving(true);
    setFeedback(null);
    try {
      await requestAPI("/api/v1/admin/real-estate-properties/bulk", {
        method: "POST",
        body: JSON.stringify({ records }),
      });
      setIsBulkModalOpen(false);
      await loadRecords();
      setFeedback({
        type: "success",
        message: records.length + " imóvel(is) importado(s) com sucesso.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(ids) {
    if (
      !ids.length ||
      !window.confirm(
        "Deseja excluir " + ids.length + " imóvel(is) selecionado(s)?",
      )
    )
      return;
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
            <div className={styles.toolbar}>
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
              {canCreate && (
                <div className={styles.toolbarActions}>
                  <Button
                    type="button"
                    variant="outline"
                    icon="fa-file-csv"
                    onClick={() => setIsBulkModalOpen(true)}
                  >
                    Importar CSV
                  </Button>
                  <Button
                    type="button"
                    icon="fa-plus"
                    onClick={() => {
                      setModalRecord(null);
                      setIsModalOpen(true);
                    }}
                  >
                    Novo imóvel
                  </Button>
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
                  <div className={styles.tableWrapper}>
                    <table>
                      <thead>
                        <tr>
                          {canDelete && (
                            <th>
                              <input
                                type="checkbox"
                                aria-label="Selecionar todos desta página"
                                checked={allVisibleSelected}
                                onChange={(event) =>
                                  togglePageSelection(event.target.checked)
                                }
                              />
                            </th>
                          )}
                          {TABLE_FIELDS.map(([field, label]) => (
                            <th key={field}>{label}</th>
                          ))}
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRecords.map((record) => (
                          <tr key={record.id}>
                            {canDelete && (
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={
                                    "Selecionar imóvel " +
                                    record.physical_registration
                                  }
                                  checked={selectedIds.includes(record.id)}
                                  onChange={() =>
                                    setSelectedIds((current) =>
                                      current.includes(record.id)
                                        ? current.filter(
                                            (id) => id !== record.id,
                                          )
                                        : [...current, record.id],
                                    )
                                  }
                                />
                              </td>
                            )}
                            {TABLE_FIELDS.map(([field]) => (
                              <td key={field}>{record[field] ?? "—"}</td>
                            ))}
                            <td className={styles.actions}>
                              <Button
                                type="button"
                                variant="outline"
                                icon={canUpdate ? "fa-edit" : "fa-eye"}
                                onClick={() => {
                                  setModalRecord(record);
                                  setIsModalOpen(true);
                                }}
                              >
                                {canUpdate ? "Editar" : "Visualizar"}
                              </Button>
                              {canDelete && (
                                <Button
                                  type="button"
                                  variant="danger"
                                  icon="fa-trash"
                                  onClick={() => handleDelete([record.id])}
                                  disabled={isDeleting}
                                >
                                  Excluir
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.pagination}>
                    <label>
                      Registros por página{" "}
                      <select
                        className={shared.input}
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(
                            event.target.value === "all"
                              ? "all"
                              : Number(event.target.value),
                          );
                          setPage(1);
                        }}
                      >
                        {PAGE_SIZES.map((size) => (
                          <option value={size} key={size}>
                            {size}
                          </option>
                        ))}
                        <option value="all">Todos</option>
                      </select>
                    </label>
                    <div>
                      <span>
                        Página {currentPage} de {pageCount}
                      </span>
                      <div className={styles.pageButtons}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPage(1)}
                          disabled={currentPage === 1}
                        >
                          «
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          ‹
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPage(currentPage + 1)}
                          disabled={currentPage === pageCount}
                        >
                          ›
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPage(pageCount)}
                          disabled={currentPage === pageCount}
                        >
                          »
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </section>
        </main>
      </Layout>
      {isBulkModalOpen && (
        <RealEstatePropertyBulkModal
          isSaving={isSaving}
          onClose={() => {
            if (!isSaving) setIsBulkModalOpen(false);
          }}
          onSubmit={handleBulkImport}
        />
      )}
      {isModalOpen && (
        <RealEstatePropertyModal
          key={modalRecord?.id || "new"}
          record={modalRecord}
          isReadOnly={!modalRecord ? false : !canUpdate}
          isSaving={isSaving}
          onClose={() => {
            if (!isSaving) {
              setIsModalOpen(false);
              setModalRecord(null);
            }
          }}
          onSubmit={handleSave}
        />
      )}
    </>
  );
}

export default RealEstatePropertiesPage;
