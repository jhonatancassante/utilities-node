import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import { hasAdminAccess } from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function PositionEditor({ recordId }) {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [record, setRecord] = useState(null);
  const [name, setName] = useState("");
  const [isLoadingRecord, setIsLoadingRecord] = useState(Boolean(recordId));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isEditing = Boolean(recordId);
  const requiredFeature = isEditing ? "read:position" : "create:position";
  const canUpdate = user?.features?.includes("update:position");

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (!isLoading && user && !user.features.includes(requiredFeature)) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, requiredFeature, router, user]);

  useEffect(() => {
    if (
      !recordId ||
      !user ||
      !user.features.includes("read:position")
    ) {
      return undefined;
    }

    let active = true;
    requestAPI("/api/v1/admin/positions/" + encodeURIComponent(recordId))
      .then((data) => {
        if (active) {
          setRecord(data);
          setName(data.name);
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
        if (active) setIsLoadingRecord(false);
      });

    return () => {
      active = false;
    };
  }, [recordId, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedName = name.trim();

    if (!normalizedName || normalizedName.length > 60) {
      setFeedback({
        type: "error",
        message: "Informe um nome de cargo com até 60 caracteres.",
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      await requestAPI(
        isEditing
          ? "/api/v1/admin/positions/" + encodeURIComponent(recordId)
          : "/api/v1/admin/positions",
        {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify({ name: normalizedName }),
        },
      );
      router.push("/admin/positions");
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

  const title = isEditing
    ? canUpdate
      ? "Editar cargo"
      : "Consultar cargo"
    : "Cadastrar cargo";

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
    !user.features.includes(requiredFeature)
  ) {
    return null;
  }

  return (
    <>
      <AppHead title={title} description="Gerencie os cargos do sistema." />
      <Layout>
        <main className={shared.container}>
          <section className={shared.card + " " + styles.card}>
            <AdminBackButton
              href="/admin/positions"
              label="Voltar aos cargos"
            />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-id-badge"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>{title}</h1>
              <p>
                {isEditing
                  ? "Consulte os dados do cargo ou altere seu nome."
                  : "Informe o nome do novo cargo. O limite é de 60 caracteres."}
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

            {isEditing && !record ? (
              <p className={styles.empty}>
                Não foi possível carregar o cargo informado.
              </p>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div>
                  <label className={shared.label} htmlFor="position-name">
                    Nome do cargo *
                  </label>
                  <input
                    className={shared.input}
                    id="position-name"
                    type="text"
                    value={name}
                    maxLength={60}
                    onChange={(event) => setName(event.target.value)}
                    disabled={isSaving || (isEditing && !canUpdate)}
                    required
                    autoComplete="off"
                  />
                  <span className={styles.counter}>{name.length}/60</span>
                </div>
                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/admin/positions")}
                    disabled={isSaving}
                  >
                    Voltar
                  </Button>
                  {(!isEditing || canUpdate) && (
                    <Button type="submit" icon="fa-save" disabled={isSaving}>
                      {isSaving
                        ? "Salvando..."
                        : isEditing
                          ? "Salvar alterações"
                          : "Cadastrar cargo"}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </section>
        </main>
      </Layout>
    </>
  );
}

export default PositionEditor;
