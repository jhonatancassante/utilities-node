import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHead from "@/components/AppHead";
import AdminBackButton from "@/components/AdminBackButton";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import { hasAdminAccess, hasAdminSectionAccess } from "@/models/authorization.js";
import getGroupingIssues from "@/lib/client/real-estate-property-grouping.js";
import {
  getRealEstatePropertyImportDraft,
  saveRealEstatePropertyImportDraft,
} from "@/lib/client/real-estate-property-import-draft.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function RealEstatePropertyGroupingReviewPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [records, setRecords] = useState([]);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    getRealEstatePropertyImportDraft()
      .then((draft) => {
        if (!active) return;
        if (!draft) {
          setLoadError("A prévia da importação não foi encontrada. Volte à página de imóveis e leia o CSV novamente.");
          return;
        }
        setRecords(draft);
      })
      .catch(() => {
        if (active) setLoadError("Não foi possível recuperar os dados do arquivo CSV.");
      })
      .finally(() => {
        if (active) setIsLoadingDraft(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !user && (!error || [401, 403].includes(error.statusCode))) {
      router.replace("/login");
    }
    if (!isLoading && user && !hasAdminSectionAccess(user, "real-estate-properties")) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, router, user]);

  const groups = useMemo(() => getGroupingIssues(records), [records]);

  function updateGrouping(physicalPropertyId, grouping) {
    setRecords((current) =>
      current.map((record) =>
        record.physical_property_id === physicalPropertyId
          ? { ...record, grouping }
          : record,
      ),
    );
  }

  async function handleSave() {
    setIsSaving(true);
    setLoadError("");
    try {
      await saveRealEstatePropertyImportDraft(records);
      await router.push("/admin/real-estate-properties");
    } catch {
      setLoadError("Não foi possível salvar as correções no navegador.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Revisar englobamento" />
        <Layout><main className={shared.container}><section className={shared.card}><p>Carregando permissões...</p></section></main></Layout>
      </>
    );
  }
  if (error) {
    return (
      <>
        <AppHead title="Revisar englobamento" />
        <Layout>
          <main className={shared.container}>
            <section className={shared.card}>
              <StatusMessage type="critical" name={error.name} action={error.action}>{error.message}</StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }
  if (!user || !hasAdminSectionAccess(user, "real-estate-properties")) return null;

  return (
    <>
      <AppHead title="Revisar englobamento" description="Confira e corrija as classificações de englobamento dos imóveis antes da importação." />
      <Layout>
        <main className={shared.container + " " + shared.containerUltraWide}>
          <section className={shared.card + " " + shared.cardUltraWide + " " + styles.card}>
            <AdminBackButton />
            <header className={styles.header}>
              <span className={shared.badge}>IMPORTAÇÃO DE IMÓVEIS</span>
              <h1>Revisar englobamento</h1>
              <p>Confira os cadastros agrupados por CTM e ajuste a classificação de englobamento. As alterações serão aplicadas somente à prévia do CSV, antes do envio ao banco de dados.</p>
            </header>
            {loadError && <div className={styles.feedback}><StatusMessage type="inline-error">{loadError}</StatusMessage></div>}
            {isLoadingDraft ? (
              <p className={styles.empty}>Carregando dados da importação...</p>
            ) : records.length === 0 ? (
              <p className={styles.empty}>Nenhum registro disponível para revisão.</p>
            ) : groups.length === 0 ? (
              <div className={styles.success}>
                <strong>Nenhuma inconsistência de englobamento encontrada.</strong>
                <p>Você pode salvar e retornar à importação.</p>
              </div>
            ) : (
              <>
                <div className={styles.summary}>
                  <strong>{groups.length} CTM(s) com inconsistências</strong>
                  <span>{groups.reduce((total, group) => total + group.properties.length, 0)} cadastro(s) para revisar</span>
                </div>
                {groups.map((group) => (
                  <section className={styles.group} key={group.ctm}>
                    <header className={styles.groupHeader}>
                      <div><h2>CTM {group.properties[0].ctm}</h2><span>{group.properties.length} cadastro(s) no arquivo</span></div>
                    </header>
                    <ul className={styles.issueList}>
                      {group.issues.map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead><tr><th>ID físico</th><th>Cadastro do imóvel</th><th>CTM</th><th>CTM Count</th><th>Englobamento</th></tr></thead>
                        <tbody>
                          {group.properties.map((record) => (
                            <tr key={record.physical_property_id}>
                              <td>{record.physical_property_id}</td>
                              <td>{record.physical_registration}</td>
                              <td>{record.ctm}</td>
                              <td>{record.ctm_count}</td>
                              <td>
                                <select className={shared.input} value={record.grouping} onChange={(event) => updateGrouping(record.physical_property_id, event.target.value)} aria-label={"Englobamento do cadastro " + record.physical_registration}>
                                  <option value="I">I — Individual</option>
                                  <option value="P">P — Principal</option>
                                  <option value="A">A — Agregado</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </>
            )}
            <footer className={styles.actions}>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/real-estate-properties")} disabled={isSaving}>Voltar sem salvar</Button>
              <Button type="button" onClick={handleSave} disabled={isSaving || isLoadingDraft || Boolean(loadError)}>{isSaving ? "Salvando..." : "Salvar correções"}</Button>
            </footer>
            <p className={styles.note}>A revisão é opcional. Mesmo que ainda existam inconsistências, a importação continuará disponível na página anterior.</p>
          </section>
        </main>
      </Layout>
    </>
  );
}

export default RealEstatePropertyGroupingReviewPage;
