import { useCallback, useEffect, useMemo, useState } from "react";
import AdminBackButton from "@/components/AdminBackButton";
import { useRouter } from "next/router";

import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import Modal from "@/components/Modal";
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
  const [privilegedOnly, setPrivilegedOnly] = useState(false);
  const [protectedOnly, setProtectedOnly] = useState(false);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const canCreate = user?.features?.includes("create:feature") ?? false;
  const canUpdate = user?.features?.includes("update:feature") ?? false;
  const canDelete = user?.features?.includes("delete:feature") ?? false;
  const hasFeaturesAccess =
    !isLoading && Boolean(user) && hasAdminSectionAccess(user, "features");

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
    setIsLoadingFeatures(true);
    try {
      const loadedFeatures = await requestAPI("/api/v1/admin/features");
      setFeatures(loadedFeatures);
      return true;
    } catch (requestError) {
      if (showFeedback) {
        setFeedback((current) => ({
          id: (current?.id ?? 0) + 1,
          type: "error",
          name: requestError.statusCode ? requestError.name : undefined,
          message: requestError.message,
          action: requestError.action,
        }));
      }
      return false;
    } finally {
      setIsLoadingFeatures(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFeaturesAccess) {
      return undefined;
    }

    let active = true;

    async function fetchInitialFeatures() {
      setIsLoadingFeatures(true);
      try {
        const loadedFeatures = await requestAPI("/api/v1/admin/features");
        if (!active) return;
        setFeatures(loadedFeatures);
      } catch (requestError) {
        if (!active) return;
        setFeedback((current) => ({
          id: (current?.id ?? 0) + 1,
          type: "error",
          name: requestError.statusCode ? requestError.name : undefined,
          message: requestError.message,
          action: requestError.action,
        }));
      } finally {
        if (active) {
          setIsLoadingFeatures(false);
        }
      }
    }

    fetchInitialFeatures();

    return () => {
      active = false;
    };
  }, [hasFeaturesAccess]);

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
      if (privilegedOnly && !feature.is_privileged) return false;
      if (protectedOnly && !feature.is_protected) return false;
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
  }, [features, searchTerm, privilegedOnly, protectedOnly]);

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
      return requestError;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteFeature(feature) {
    setDeleteCandidate(feature);
  }

  async function confirmDeleteFeature() {
    const feature = deleteCandidate;
    if (!feature) return;
    setDeleteCandidate(null);
    setFeedback(null);
    try {
      await requestAPI(
        "/api/v1/admin/features/" + encodeURIComponent(feature.id),
        { method: "DELETE" },
      );
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
        name: requestError.statusCode ? requestError.name : undefined,
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
              <StatusMessage
                type="critical"
                name={error.statusCode ? error.name : undefined}
                action={error.action}
              >
                {error.statusCode
                  ? error.message
                  : "Não foi possível verificar suas permissões."}
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
            <AdminBackButton />

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
                <div className={styles.searchFilters}>
                  <label className={styles.filterSwitch}>
                    <input
                      type="checkbox"
                      checked={privilegedOnly}
                      onChange={(event) =>
                        setPrivilegedOnly(event.target.checked)
                      }
                    />
                    <span className={styles.switch} aria-hidden="true"></span>
                    <span>Privilegiadas</span>
                  </label>
                  <label className={styles.filterSwitch}>
                    <input
                      type="checkbox"
                      checked={protectedOnly}
                      onChange={(event) =>
                        setProtectedOnly(event.target.checked)
                      }
                    />
                    <span className={styles.switch} aria-hidden="true"></span>
                    <span>Protegidas</span>
                  </label>
                </div>
              </div>
              {canCreate && (
                <Button
                  type="button"
                  icon="fa-plus"
                  onClick={handleStartCreate}
                  disabled={isSaving}
                >
                  Nova feature
                </Button>
              )}
            </div>

            {feedback && (
              <StatusMessage
                type={feedback.type}
                name={feedback.name}
                action={feedback.action}
                resetKey={feedback}
              >
                {feedback.message}
              </StatusMessage>
            )}

            {(creating || editingFeature) && (
              <Modal
                title={creating ? "Nova feature" : "Editar feature"}
                onClose={() => {
                  if (!isSaving) {
                    setCreating(false);
                    setEditingFeature(null);
                  }
                }}
                wide
              >
                <FeatureForm
                  key={creating ? "new-feature" : editingFeature.id}
                  feature={editingFeature}
                  onSubmit={(values) =>
                    handleSaveFeature(
                      values,
                      editingFeature ? editingFeature.id : null,
                    )
                  }
                  onCancel={() => {
                    setCreating(false);
                    setEditingFeature(null);
                  }}
                  isSaving={isSaving}
                  title={creating ? "Nova feature" : "Editar feature"}
                />
              </Modal>
            )}

            {deleteCandidate && (
              <Modal
                title="Confirmar exclusão"
                onClose={() => setDeleteCandidate(null)}
              >
                <p className={styles.confirmText}>
                  Deseja realmente excluir a feature{" "}
                  <strong>{deleteCandidate.name}</strong>? Essa ação não poderá
                  ser desfeita pela interface.
                </p>
                <div className={styles.formActions}>
                  <Button
                    type="button"
                    variant="danger"
                    icon="fa-trash-alt"
                    onClick={confirmDeleteFeature}
                  >
                    Excluir feature
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    icon="fa-times"
                    onClick={() => setDeleteCandidate(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </Modal>
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
                                    {!feature.is_self_removable && (
                                      <span
                                        className={`${styles.badgeIcon} ${styles.nonRemovableBadge}`}
                                        title="Não pode ser removida pelo próprio usuário"
                                        role="img"
                                        aria-label="Não pode ser removida pelo próprio usuário"
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
                                    disabled={isSaving}
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
                                    disabled={isSaving}
                                    onClick={() => handleDeleteFeature(feature)}
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

function FeatureForm({ feature, onSubmit, onCancel, isSaving, title }) {
  const [form, setForm] = useState({
    name: feature?.name ?? "",
    label: feature?.label ?? "",
    group_name: feature?.group_name ?? "",
    description: feature?.description ?? "",
    is_self_removable: feature?.is_self_removable ?? true,
    is_privileged: feature?.is_privileged ?? false,
    is_protected: feature?.is_protected ?? false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: null }));
    setFormError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = {};

    if (!form.name.trim()) {
      errors.name = "Informe o nome identificador.";
    } else if (form.name.trim().length > 50) {
      errors.name = "Utilize no máximo 50 caracteres.";
    } else if (!/^[a-z][a-z0-9]*(?::[a-z][a-z0-9]*)*$/.test(form.name.trim())) {
      errors.name =
        "Use letras minúsculas, números e dois-pontos (ex.: read:user).";
    }

    if (!form.label.trim()) {
      errors.label = "Informe o título.";
    } else if (form.label.trim().length > 50) {
      errors.label = "Utilize no máximo 50 caracteres.";
    }

    if (!form.group_name.trim()) {
      errors.group_name = "Informe o grupo.";
    } else if (form.group_name.trim().length > 50) {
      errors.group_name = "Utilize no máximo 50 caracteres.";
    }

    if (!form.description.trim()) {
      errors.description = "Informe a descrição.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setFormError(null);
      return;
    }

    setFormError(null);
    const requestError = await onSubmit({
      ...form,
      name: form.name.trim(),
      label: form.label.trim(),
      group_name: form.group_name.trim(),
      description: form.description.trim(),
    });

    if (requestError) {
      setFormError({
        name: requestError.statusCode ? requestError.name : undefined,
        message: requestError.message,
        action: requestError.action,
      });
    }
  }

  return (
    <section className={styles.editor} aria-label={title}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        {feature && <span className={styles.featureId}>ID: {feature.id}</span>}
      </div>

      <form onSubmit={handleSubmit} noValidate>
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
              disabled={isSaving}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={
                fieldErrors.name ? "feature-name-error" : undefined
              }
            />
            {fieldErrors.name ? (
              <small
                className={styles.fieldError}
                id="feature-name-error"
                role="alert"
              >
                {fieldErrors.name}
              </small>
            ) : (
              <small className={styles.fieldHint}>
                Use letras minúsculas, números e dois-pontos.
              </small>
            )}
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
              disabled={isSaving}
              aria-invalid={Boolean(fieldErrors.label)}
              aria-describedby={
                fieldErrors.label ? "feature-label-error" : undefined
              }
            />
            {fieldErrors.label && (
              <small
                className={styles.fieldError}
                id="feature-label-error"
                role="alert"
              >
                {fieldErrors.label}
              </small>
            )}
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
              disabled={isSaving}
              aria-invalid={Boolean(fieldErrors.group_name)}
              aria-describedby={
                fieldErrors.group_name ? "feature-group-error" : undefined
              }
            />
            {fieldErrors.group_name && (
              <small
                className={styles.fieldError}
                id="feature-group-error"
                role="alert"
              >
                {fieldErrors.group_name}
              </small>
            )}
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
              disabled={isSaving}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description
                  ? "feature-description-error"
                  : undefined
              }
            />
            {fieldErrors.description && (
              <small
                className={styles.fieldError}
                id="feature-description-error"
                role="alert"
              >
                {fieldErrors.description}
              </small>
            )}
          </div>
        </div>

        <div className={styles.flags}>
          <label>
            <input
              type="checkbox"
              checked={form.is_self_removable}
              onChange={(event) =>
                updateField("is_self_removable", event.target.checked)
              }
              disabled={isSaving}
            />
            <span className={styles.switch} aria-hidden="true"></span>
            <span>Permite retirar de si mesmo</span>
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
            <span className={styles.switch} aria-hidden="true"></span>
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
            <span className={styles.switch} aria-hidden="true"></span>
            <span>Feature protegida</span>
          </label>
        </div>

        {formError && (
          <div className={styles.feedback} role="alert">
            <StatusMessage
              type="inline-error"
              name={formError.name}
              action={formError.action}
            >
              {formError.message}
            </StatusMessage>
          </div>
        )}

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
