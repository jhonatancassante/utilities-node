import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHead from "@/components/AppHead";
import AdminBackButton from "@/components/AdminBackButton";
import Button from "@/components/Button";
import DataTable from "@/components/DataTable";
import usePagination from "@/hooks/use-pagination.js";
import useRowSelection from "@/hooks/use-row-selection.js";
import useSortableData from "@/hooks/use-sortable-data.js";
import Layout from "@/components/Layout";
import RealEstatePropertyBulkModal from "@/components/RealEstatePropertyBulkModal";
import StatusMessage from "@/components/StatusMessage";
import TableSection from "@/components/TableSection";
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
  const selection = useRowSelection();
  const clearSelection = selection.clear;
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(
    String(new Date().getFullYear()),
  );
  const [updatedFilter, setUpdatedFilter] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [dialog, setDialog] = useState(null);
  const canCreate = user?.features?.includes("create:real_estate_property");
  const canUpdate = user?.features?.includes("update:real_estate_property");
  const canDelete = user?.features?.includes("delete:real_estate_property");

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      const data = await requestAPI("/api/v1/admin/real-estate-properties");
      setRecords(data);
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
  const sort = useSortableData(filteredRecords);
  const pagination = usePagination(sort.sortedRecords);

  async function handleBulkImport(records, onProgress) {
    setIsSaving(true);
    setFeedback(null);
    let importId;
    try {
      const targetChunkBytes = 750 * 1024;
      const encoder = new TextEncoder();
      const chunks = [];
      let currentChunk = [];
      let currentChunkBytes = 2;

      for (const record of records) {
        const recordBytes = encoder.encode(JSON.stringify(record)).length;
        const additionalBytes = recordBytes + (currentChunk.length ? 1 : 0);
        if (
          currentChunk.length &&
          currentChunkBytes + additionalBytes > targetChunkBytes
        ) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentChunkBytes = 2;
        }
        if (recordBytes + 2 > targetChunkBytes) {
          throw new Error(
            "Um registro excede o tamanho máximo permitido para um lote.",
          );
        }
        currentChunk.push(record);
        currentChunkBytes += recordBytes + (currentChunk.length > 1 ? 1 : 0);
      }
      if (currentChunk.length) {
        chunks.push(currentChunk);
      }

      const importSession = await requestAPI(
        "/api/v1/admin/real-estate-properties/bulk/imports",
        {
          method: "POST",
          body: JSON.stringify({
            totalRecords: records.length,
            totalChunks: chunks.length,
          }),
        },
      );
      importId = importSession.id;

      for (let index = 0; index < chunks.length; index += 1) {
        onProgress?.({
          stage: "uploading",
          current: index + 1,
          total: chunks.length,
        });
        await requestAPI(
          "/api/v1/admin/real-estate-properties/bulk/imports/" +
            encodeURIComponent(importId) +
            "/chunks",
          {
            method: "POST",
            body: JSON.stringify({ chunkIndex: index, records: chunks[index] }),
          },
        );
      }

      onProgress?.({ stage: "finalizing" });
      try {
        await requestAPI(
          "/api/v1/admin/real-estate-properties/bulk/imports/" +
            encodeURIComponent(importId) +
            "/finalize",
          {
            method: "POST",
            body: JSON.stringify({ overwriteExisting: false }),
          },
        );
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
            importId,
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
      if (importId) {
        try {
          await requestAPI(
            "/api/v1/admin/real-estate-properties/bulk/imports/" +
              encodeURIComponent(importId),
            { method: "DELETE" },
          );
        } catch {
          // A sessão expira automaticamente se a limpeza não puder ser concluída.
        }
      }
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
    if (!ids.length) {
      return;
    }
    setDialog({
      type: "delete",
      ids,
      message: "Deseja excluir " + ids.length + " imóvel(is) selecionado(s)?",
    });
  }

  async function confirmDialog() {
    const currentDialog = dialog;
    if (!currentDialog) {
      return;
    }
    setDialog(null);

    if (currentDialog.type === "bulk-import") {
      setFeedback(null);
      try {
        await requestAPI(
          "/api/v1/admin/real-estate-properties/bulk/imports/" +
            encodeURIComponent(currentDialog.importId) +
            "/finalize",
          { method: "POST", body: JSON.stringify({ overwriteExisting: true }) },
        );
        await loadRecords();
        setFeedback({
          type: "success",
          message: "Importação concluída e imóveis existentes atualizados.",
        });
        currentDialog.resolve(true);
      } catch (requestError) {
        try {
          await requestAPI(
            "/api/v1/admin/real-estate-properties/bulk/imports/" +
              encodeURIComponent(currentDialog.importId),
            { method: "DELETE" },
          );
        } catch {
          // A sessão expira automaticamente se a limpeza não puder ser concluída.
        }
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

    if (currentDialog.type !== "delete") {
      return;
    }
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
  if (!user || !hasAdminSectionAccess(user, "real-estate-properties")) {
    return null;
  }

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
                      pagination.resetPage();
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
                      pagination.resetPage();
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
                        pagination.resetPage();
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
            <TableSection
              title="Imóveis cadastrados"
              countLabel={filteredRecords.length + " registro(s)"}
              actions={
                canDelete &&
                selection.selectedIds.length > 0 && (
                  <Button
                    type="button"
                    variant="danger"
                    icon="fa-trash"
                    onClick={() => handleDelete(selection.selectedIds)}
                    disabled={isDeleting}
                  >
                    {isDeleting
                      ? "Excluindo..."
                      : "Excluir selecionados (" +
                        selection.selectedIds.length +
                        ")"}
                  </Button>
                )
              }
            >
              <DataTable
                records={pagination.visibleRecords}
                loading={isLoadingRecords}
                loadingMessage="Carregando imóveis..."
                emptyMessage="Nenhum imóvel encontrado."
                columns={TABLE_FIELDS.map(([key, label]) => ({ key, label }))}
                sort={sort}
                pagination={pagination}
                caption="Cadastros de imóveis"
                selection={canDelete ? selection : null}
                getSelectionLabel={(record) =>
                  "Selecionar imóvel " + record.physical_registration
                }
                renderActions={(record) => (
                  <DataTable.RowAction
                    href={
                      "/admin/real-estate-properties/" +
                      encodeURIComponent(record.id)
                    }
                    editable={canUpdate}
                  />
                )}
              />
            </TableSection>
          </section>
        </main>
      </Layout>
      {dialog && (
        <StatusMessage
          type="confirmation"
          resetKey={dialog.type + "-" + (dialog.ids?.join(",") || "bulk")}
          onConfirm={confirmDialog}
          onCancel={async () => {
            if (dialog.type === "bulk-import" && dialog.importId) {
              try {
                await requestAPI(
                  "/api/v1/admin/real-estate-properties/bulk/imports/" +
                    encodeURIComponent(dialog.importId),
                  { method: "DELETE" },
                );
              } catch {
                // A sessão expira automaticamente se a limpeza não puder ser concluída.
              }
            }
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
