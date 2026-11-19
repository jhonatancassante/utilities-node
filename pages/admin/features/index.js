import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
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

function AdminFeaturesPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [features, setFeatures] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const canCreate = user?.features?.includes("create:feature") ?? false;
  const canUpdate = user?.features?.includes("update:feature") ?? false;
  const canDelete = user?.features?.includes("delete:feature") ?? false;

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }

    if (!isLoading && user && !hasAdminSectionAccess(user, "features")) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, router, user]);

  const loadFeatures = useCallback(async ({ showFeedback = true } = {}) => {
    try {
      const loadedFeatures = await requestAPI("/api/v1/admin/features");
      setFeatures(loadedFeatures);
      return true;
    } catch (requestError) {
      if (showFeedback) {
        setFeedback({
          type: "error",
          message: requestError.message,
          action: requestError.action,
        });
      }
      return false;
    } finally {
      setIsLoadingFeatures(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user && hasAdminSectionAccess(user, "features")) {
      loadFeatures();
    }
  }, [isLoading, loadFeatures, user]);

  useEffect(() => {
    if (feedback?.type !== "success") return undefined;

    const timeoutId = setTimeout(() => {
      setFeedback((currentFeedback) =>
        currentFeedback?.type === "success" ? null : currentFeedback,
      );
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [feedback]);

  const groupedFeatures = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("pt-BR");
    const filteredFeatures = features.filter((feature) => {
      if (!term) return true;

      return [
        feature.name,
        feature.label,
        feature.group_name,
        feature.description,
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(term));
    });

    return filteredFeatures.reduce((groups, feature) => {
      if (!Object.hasOwn(groups, feature.group_name)) {
        groups[feature.group_name] = [];
      }
      groups[feature.group_name].push(feature);
      return groups;
    }, Object.create(null));
  }, [features, searchTerm]);

  const sortedGroups = Object.keys(groupedFeatures).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const visibleFeatureCount = sortedGroups.reduce(
    (total, group) => total + groupedFeatures[group].length,
    0,
  );

  async function handleSaveFeature(featureValues, featureId) {
    setIsSaving(true);
    setFeedback(null);

    try {
      await requestAPI(
        featureId
          ? `/api/v1/admin/features/${encodeURIComponent(featureId)}`
          : "/api/v1/admin/features",
        {
          method: featureId ? "PATCH" : "POST",
          body: JSON.stringify(featureValues),
        },
      );

      setCreating(false);
      setEditingFeature(null);
      setIsLoadingFeatures(true);
      const refreshed = await loadFeatures({ showFeedback: false });

      setFeedback({
        type: refreshed ? "success" : "error",
        message: refreshed
          ? featureId
            ? "Feature atualizada com sucesso."
            : "Feature cadastrada com sucesso."
          : "A alteração foi salva, mas não foi possível atualizar a listagem.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteFeature(feature) {
    const confirmed = window.confirm(
      `Deseja realmente excluir a feature "${feature.name}"? Essa ação não poderá ser desfeita pela interface.`,
    );

    if (!confirmed) return;

    setFeedback(null);

    try {
      await requestAPI(
        `/api/v1/admin/features/${encodeURIComponent(feature.id)}`,
        { method: "DELETE" },
      );

      setIsLoadingFeatures(true);
      const refreshed = await loadFeatures({ showFeedback: false });
      setFeedback({
        type: refreshed ? "success" : "error",
        message: refreshed
          ? "Feature excluída com sucesso."
          : "A feature foi excluída, mas não foi possível atualizar a listagem.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        message: requestError.message,
        action: requestError.action,
      });
    }
  }

  function handleStartCreate() {
    setEditingFeature(null);
    setCreating(true);
    setFeedback(null);
  }

  function handleStartEdit(feature) {
    setCreating(false);
    setEditingFeature(feature);
    setFeedback(null);
  }

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Gerenciar features" />
        <Layout>
          <main className={`${shared.container} ${shared.containerUltraWide}`}>
            <section
              className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
            >
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
        <AppHead title="Gerenciar features" />
        <Layout>
          <main className={`${shared.container} ${shared.containerUltraWide}`}>
            <section
              className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
            >
              <StatusMessage type="error">
                Não foi possível verificar suas permissões.
              </StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (!user || !hasAdminSectionAccess(user, "features")) return null;

  return (
    <>
      <AppHead
        title="Gerenciar features"
        description="Consulte e gerencie as permissões disponíveis no sistema."
      />
      <Layout>
        <main className={`${shared.container} ${shared.containerUltraWide}`}>
          <section
            className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
          >
            <Link href="/admin" className={styles.backLink}>
              <i className="fas fa-arrow-left" aria-hidden="true"></i>
              Painel administrativo
            </Link>

            <header className={styles.pageHeader}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-key"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>Gerenciar features</h1>
              <p className={styles.description}>
                Consulte as permissões do sistema, pesquise por nome ou grupo e
                gerencie as features de acordo com suas permissões.
              </p>
            </header>

            <div className={styles.toolbar}>
              <div className={styles.searchField}>
                <label className={shared.label} htmlFor="feature-search">
                  Pesquisar features
                </label>
                <input
                  className={shared.input}
                  id="feature-search"
                  type="search"
                  placeholder="Nome, título, grupo ou descrição"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              {canCreate && (
                <Button
                  type="button"
                  icon="fa-plus"
                  onClick={handleStartCreate}
                  disabled={creating || isSaving}
                >
                  Nova feature
                </Button>
              )}
            </div>

            {feedback && (
              <div className={styles.feedback} role="status">
                <StatusMessage type={feedback.type}>
                  {feedback.message}
                </StatusMessage>
                {feedback.action && (
                  <p className={styles.errorAction}>{feedback.action}</p>
                )}
              </div>
            )}

            {creating && (
              <FeatureForm
                key="new-feature"
                onSubmit={(values) => handleSaveFeature(values, null)}
                onCancel={() => setCreating(false)}
                isSaving={isSaving}
                title="Nova feature"
              />
            )}

            {editingFeature && (
              <FeatureForm
                key={editingFeature.id}
                feature={editingFeature}
                onSubmit={(values) =>
                  handleSaveFeature(values, editingFeature.id)
                }
                onCancel={() => setEditingFeature(null)}
                isSaving={isSaving}
                title="Editar feature"
              />
            )}

            <section
              className={styles.results}
              aria-label="Features cadastradas"
            >
              <div className={styles.sectionHeading}>
                <h2>Features cadastradas</h2>
                <span>
                  {isLoadingFeatures
                    ? "Carregando..."
                    : `${visibleFeatureCount} de ${features.length} feature(s)`}
                </span>
              </div>

              {isLoadingFeatures ? (
                <p className={styles.emptyState}>Carregando features...</p>
              ) : visibleFeatureCount === 0 ? (
                <p className={styles.emptyState}>
                  {features.length === 0
                    ? "Nenhuma feature cadastrada."
                    : "Nenhuma feature corresponde à pesquisa."}
                </p>
              ) : (
                <div className={styles.groups}>
                  {sortedGroups.map((group) => (
                    <section className={styles.featureGroup} key={group}>
                      <h3>{group}</h3>
                      <ul className={styles.featureList}>
                        {groupedFeatures[group]
                          .sort((a, b) =>
                            a.label.localeCompare(b.label, "pt-BR"),
                          )
                          .map((feature) => (
                            <li className={styles.featureItem} key={feature.id}>
                              <div className={styles.featureDetails}>
                                <div className={styles.featureHeading}>
                                  <strong>{feature.label}</strong>
                                  <div className={styles.badges}>
                                    {feature.is_privileged && (
                                      <span
                                        className={`${styles.badgeIcon} ${styles.privilegedBadge}`}
                                        title="Feature privilegiada"
                                        role="img"
                                        aria-label="Feature privilegiada"
                                      >
                                        <i
                                          className="fas fa-crown"
                                          aria-hidden="true"
                                        ></i>
                                      </span>
                                    )}
                                    {!feature.is_removable && (
                                      <span
                                        className={`${styles.badgeIcon} ${styles.nonRemovableBadge}`}
                                        title="Não pode ser removida de usuários"
                                        role="img"
                                        aria-label="Não pode ser removida de usuários"
                                      >
                                        <i
                                          className="fas fa-ban"
                                          aria-hidden="true"
                                        ></i>
                                      </span>
                                    )}
                                    {feature.is_protected && (
                                      <span
                                        className={`${styles.badgeIcon} ${styles.protectedBadge}`}
                                        title="Feature protegida"
                                        role="img"
                                        aria-label="Feature protegida"
                                      >
                                        <i
                                          className="fas fa-shield-alt"
                                          aria-hidden="true"
                                        ></i>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <code>{feature.name}</code>
                                <p>{feature.description}</p>
                              </div>

                              <div className={styles.actions}>
                                {canUpdate && !feature.is_protected && (
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    title="Alterar feature"
                                    aria-label={`Alterar feature ${feature.name}`}
                                    disabled={isSaving || creating}
                                    onClick={() => handleStartEdit(feature)}
                                  >
                                    <i
                                      className="fas fa-pen"
                                      aria-hidden="true"
                                    ></i>
                                  </button>
                                )}
                                {canDelete && !feature.is_protected && (
                                  <button
                                    type="button"
                                    className={`${styles.iconButton} ${styles.deleteButton}`}
                                    title="Excluir feature"
                                    aria-label={`Excluir feature ${feature.name}`}
                                    disabled={isSaving || creating}
                                    onClick={() =>
                                      handleDeleteFeature(feature)
                                    }
                                  >
                                    <i
                                      className="fas fa-trash-alt"
                                      aria-hidden="true"
                                    ></i>
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </section>
          </section>
        </main>
      </Layout>
    </>
  );
}

function FeatureForm({
  feature,
  onSubmit,
  onCancel,
  isSaving,
  title,
}) {
  const [form, setForm] = useState({
    name: feature?.name ?? "",
    label: feature?.label ?? "",
    group_name: feature?.group_name ?? "",
    description: feature?.description ?? "",
    is_removable: feature?.is_removable ?? true,
    is_privileged: feature?.is_privileged ?? false,
    is_protected: feature?.is_protected ?? false,
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <section className={styles.editor} aria-label={title}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        {feature && <span className={styles.featureId}>ID: {feature.id}</span>}
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={shared.label} htmlFor="feature-name">
              Nome identificador
            </label>
            <input
              className={shared.input}
              id="feature-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="read:report"
              maxLength={50}
              required
              disabled={isSaving}
            />
            <small className={styles.fieldHint}>
              Use letras minúsculas, números e dois-pontos.
            </small>
          </div>

          <div className={styles.field}>
            <label className={shared.label} htmlFor="feature-label">
              Título
            </label>
            <input
              className={shared.input}
              id="feature-label"
              value={form.label}
              onChange={(event) => updateField("label", event.target.value)}
              maxLength={50}
              required
              disabled={isSaving}
            />
          </div>

          <div className={styles.field}>
            <label className={shared.label} htmlFor="feature-group">
              Grupo
            </label>
            <input
              className={shared.input}
              id="feature-group"
              value={form.group_name}
              onChange={(event) =>
                updateField("group_name", event.target.value)
              }
              maxLength={50}
              required
              disabled={isSaving}
            />
          </div>

          <div className={`${styles.field} ${styles.descriptionField}`}>
            <label className={shared.label} htmlFor="feature-description">
              Descrição
            </label>
            <textarea
              className={shared.input}
              id="feature-description"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              rows={3}
              required
              disabled={isSaving}
            />
          </div>
        </div>

        <div className={styles.flags}>
          <label>
            <input
              type="checkbox"
              checked={form.is_removable}
              onChange={(event) =>
                updateField("is_removable", event.target.checked)
              }
              disabled={isSaving}
            />
            <span>Permite retirar de usuários</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.is_privileged}
              onChange={(event) =>
                updateField("is_privileged", event.target.checked)
              }
              disabled={isSaving}
            />
            <span>Feature privilegiada</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.is_protected}
              onChange={(event) =>
                updateField("is_protected", event.target.checked)
              }
              disabled={isSaving}
            />
            <span>Feature protegida</span>
          </label>
        </div>

        <div className={styles.formActions}>
          <Button type="submit" icon="fa-save" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar feature"}
          </Button>
          <Button
            type="button"
            variant="danger"
            icon="fa-times"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}

export default AdminFeaturesPage;
