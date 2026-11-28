import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import AssessedValueForm from "@/components/AssessedValueForm";
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

function AssessedValueEditor({ recordId }) {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [record, setRecord] = useState(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(Boolean(recordId));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isEditing = Boolean(recordId);
  const requiredFeature = isEditing
    ? "read:assessed_value"
    : "create:assessed_value";

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (!isLoading && user && !hasAdminSectionAccess(user, "assessed-values")) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
    if (!isLoading && user && !user.features.includes(requiredFeature)) {
      router.replace("/admin/assessed-values");
    }
  }, [error, isLoading, requiredFeature, router, user]);

  useEffect(() => {
    if (!recordId || !user || !hasAdminSectionAccess(user, "assessed-values")) {
      return undefined;
    }
    let active = true;
    requestAPI("/api/v1/admin/assessed-values/" + encodeURIComponent(recordId))
      .then((data) => {
        if (active) {
          setRecord(data);
        }
      })
      .catch((requestError) => {
        if (active) {
          setFeedback({
            type: "error",
            name: requestError.name,
            message: requestError.message,
            action: requestError.action,
          });
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingRecord(false);
        }
      });
    return () => {
      active = false;
    };
  }, [recordId, user]);

  async function handleSubmit(payload) {
    setIsSaving(true);
    setFeedback(null);
    try {
      await requestAPI(
        isEditing
          ? "/api/v1/admin/assessed-values/" + encodeURIComponent(recordId)
          : "/api/v1/admin/assessed-values",
        { method: isEditing ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      router.push("/admin/assessed-values");
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

  const canUpdate = user?.features?.includes("update:assessed_value");
  const title = isEditing
    ? canUpdate
      ? "Editar valores venais"
      : "Consultar valores venais"
    : "Cadastrar valores venais";
  if (isLoading || (!user && !error) || (isEditing && isLoadingRecord)) {
    return (
      <>
        <AppHead title={title} />
        <Layout>
          <main className={shared.container}>
            <section className={shared.card}>
              <p>Carregando dados...</p>
            </section>
          </main>
        </Layout>
      </>
    );
  }
  if (error) {
    return (
      <>
        <AppHead title={title} />
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
  if (
    !user ||
    !hasAdminSectionAccess(user, "assessed-values") ||
    !user.features.includes(requiredFeature)
  ) {
    return null;
  }

  return (
    <>
      <AppHead title={title} description="Gerencie os valores venais anuais." />
      <Layout>
        <main className={shared.container + " " + shared.containerUltraWide}>
          <section
            className={
              shared.card + " " + shared.cardUltraWide + " " + styles.card
            }
          >
            <AdminBackButton
              href="/admin/assessed-values"
              label="Voltar aos valores venais"
            />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-calculator"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>{title}</h1>
              <p>
                {canUpdate
                  ? "Informe o ano, o decreto e os valores correspondentes. Campos numéricos não preenchidos serão armazenados como nulos."
                  : "Consulta dos valores cadastrados para este exercício."}
              </p>
            </header>
            {feedback && (
              <StatusMessage
                type="inline-error"
                name={feedback.name}
                action={feedback.action}
              >
                {feedback.message}
              </StatusMessage>
            )}
            {isEditing && !record ? (
              <p>Não foi possível carregar o registro informado.</p>
            ) : (
              <AssessedValueForm
                initialValue={record}
                onSubmit={handleSubmit}
                onCancel={() => router.push("/admin/assessed-values")}
                isSaving={isSaving}
                isReadOnly={!canUpdate}
                submitLabel={
                  isEditing ? "Salvar alterações" : "Cadastrar valores"
                }
              />
            )}
          </section>
        </main>
      </Layout>
    </>
  );
}
export default AssessedValueEditor;
