import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/shared/user-validation.js";
import { featureCatalog } from "@/configs/features.js";
import { hasAdminAccess } from "@/configs/admin.js";
import shared from "@/styles/shared.module.css";
import styles from "./usuarios.module.css";

const featureGroups = [
  ...new Set(featureCatalog.map((feature) => feature.group)),
];

function AdminUsersPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (!isLoading && user && !user.features.includes("update:user:others")) {
      if (hasAdminAccess(user)) {
        router.replace("/admin");
      } else {
        router.replace("/perfil");
      }
    }
  }, [error, isLoading, router, user]);

  async function handleSearch(event) {
    event.preventDefault();
    const normalizedSearch = searchTerm.trim();

    if (normalizedSearch.length < 2) {
      setFeedback({
        type: "error",
        message: "Informe ao menos dois caracteres para pesquisar.",
      });
      return;
    }

    setIsSearching(true);
    setFeedback(null);
    setSelectedUser(null);

    try {
      const users = await requestAPI(
        `/api/v1/admin/users?search=${encodeURIComponent(normalizedSearch)}`,
      );
      setResults(users);
      if (users.length === 0) {
        setFeedback({
          type: "info",
          message: "Nenhum usuário foi encontrado para essa pesquisa.",
        });
      }
    } catch (requestError) {
      setFeedback({
        type: "error",
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSelectUser(username) {
    setFeedback(null);

    try {
      const foundUser = await requestAPI(
        `/api/v1/admin/users/${encodeURIComponent(username)}`,
      );
      setSelectedUser(foundUser);
    } catch (requestError) {
      setFeedback({
        type: "error",
        message: requestError.message,
        action: requestError.action,
      });
    }
  }

  function handleUserUpdated(updatedUser) {
    setSelectedUser(updatedUser);
    setResults((current) =>
      current.map((item) => (item.id === updatedUser.id ? updatedUser : item)),
    );
  }

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Gerenciar usuários" />
        <Layout>
          <main className={shared.container}>
            <section className={`${shared.card} ${styles.card}`}>
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
        <AppHead title="Gerenciar usuários" />
        <Layout>
          <main className={shared.container}>
            <section className={`${shared.card} ${styles.card}`}>
              <StatusMessage type="error">
                Não foi possível verificar suas permissões.
              </StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (!user || !user.features.includes("update:user:others")) {
    return null;
  }

  return (
    <>
      <AppHead
        title="Gerenciar usuários"
        description="Pesquise e gerencie contas e permissões de usuários."
      />
      <Layout>
        <main className={shared.container}>
          <section className={`${shared.card} ${styles.card}`}>
            <Link href="/admin" className={styles.backLink}>
              <i className="fas fa-arrow-left" aria-hidden="true"></i>
              Painel administrativo
            </Link>

            <div className={shared.icon} aria-hidden="true">
              <i className="fas fa-users-cog"></i>
            </div>
            <span className={shared.badge}>ADMINISTRAÇÃO</span>
            <h1>Gerenciar usuários</h1>
            <p className={styles.description}>
              Pesquise por nome de usuário ou e-mail para consultar e alterar
              os dados e as permissões de uma conta.
            </p>

            <form className={styles.searchForm} onSubmit={handleSearch}>
              <label className={shared.label} htmlFor="user-search">
                Pesquisar usuário
              </label>
              <div className={styles.searchControls}>
                <input
                  className={shared.input}
                  id="user-search"
                  type="search"
                  placeholder="Nome de usuário ou e-mail"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  disabled={isSearching}
                />
                <Button type="submit" icon="fa-search" disabled={isSearching}>
                  {isSearching ? "Pesquisando..." : "Pesquisar"}
                </Button>
              </div>
              <small className={styles.hint}>
                Digite pelo menos dois caracteres. A pesquisa retorna até 10
                resultados.
              </small>
            </form>

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

            {results.length > 0 && (
              <section
                className={styles.results}
                aria-label="Resultados da pesquisa"
              >
                <div className={styles.sectionHeading}>
                  <h2>Resultados</h2>
                  <span>{results.length} usuário(s)</span>
                </div>
                <ul className={styles.userList}>
                  {results.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        className={`${styles.userResult} ${
                          selectedUser?.id === result.id
                            ? styles.userResultActive
                            : ""
                        }`}
                        onClick={() => handleSelectUser(result.username)}
                      >
                        <span className={styles.userAvatar} aria-hidden="true">
                          {result.username.slice(0, 2).toUpperCase()}
                        </span>
                        <span className={styles.userIdentity}>
                          <strong>{result.username}</strong>
                          <small>{result.email}</small>
                        </span>
                        <i
                          className="fas fa-chevron-right"
                          aria-hidden="true"
                        ></i>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {selectedUser && (
              <UserEditor
                key={selectedUser.id}
                user={selectedUser}
                currentUserId={user.id}
                onUpdated={handleUserUpdated}
                onDeleted={(deletedId) => {
                  setResults((current) =>
                    current.filter((item) => item.id !== deletedId),
                  );
                  setSelectedUser(null);
                  setFeedback({
                    type: "success",
                    message: "Usuário removido com sucesso.",
                  });
                }}
                onCancel={() => setSelectedUser(null)}
              />
            )}
          </section>
        </main>
      </Layout>
    </>
  );
}

function UserEditor({
  user,
  currentUserId,
  onUpdated,
  onDeleted,
  onCancel,
}) {
  const [form, setForm] = useState({
    username: user.username,
    email: user.email,
    password: "",
    passwordConfirmation: "",
    features: [...user.features],
  });
  const [featureSearch, setFeatureSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const filteredFeatures = useMemo(() => {
    const term = featureSearch.trim().toLowerCase();
    return featureCatalog.filter((feature) =>
      !term ||
      feature.name.toLowerCase().includes(term) ||
      feature.label.toLowerCase().includes(term) ||
      feature.description.toLowerCase().includes(term),
    );
  }, [featureSearch]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFeedback(null);
  }

  function toggleFeature(featureName) {
    setForm((current) => ({
      ...current,
      features: current.features.includes(featureName)
        ? current.features.filter((feature) => feature !== featureName)
        : [...current.features, featureName],
    }));
    setFeedback(null);
  }

  function handleCancel() {
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      passwordConfirmation: "",
      features: [...user.features],
    });
    setFeatureSearch("");
    setFeedback(null);
    onCancel();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError =
      validateUsername(form.username.trim()) ||
      validateEmail(form.email.trim()) ||
      (form.password ? validatePassword(form.password) : null) ||
      (!form.password && form.passwordConfirmation
        ? { message: "Informe a nova senha antes de confirmá-la." }
        : form.password && !form.passwordConfirmation
          ? { message: "Confirme a nova senha." }
          : form.password && form.password !== form.passwordConfirmation
            ? { message: "As senhas informadas não coincidem." }
            : null);

    if (validationError) {
      setFeedback({ type: "error", message: validationError.message });
      return;
    }

    const payload = {};
    if (form.username.trim() !== user.username) {
      payload.username = form.username.trim();
    }
    if (form.email.trim() !== user.email) {
      payload.email = form.email.trim();
    }
    if (form.password) payload.password = form.password;

    const currentFeatures = [...user.features].sort();
    const nextFeatures = [...new Set(form.features)].sort();
    if (JSON.stringify(currentFeatures) !== JSON.stringify(nextFeatures)) {
      payload.features = nextFeatures;
    }

    if (Object.keys(payload).length === 0) {
      handleCancel();
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedUser = await requestAPI(
        `/api/v1/admin/users/${encodeURIComponent(user.username)}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      setForm({
        username: updatedUser.username,
        email: updatedUser.email,
        password: "",
        passwordConfirmation: "",
        features: [...updatedUser.features],
      });
      onUpdated(updatedUser);
      setFeedback({
        type: "success",
        message: "Alterações salvas com sucesso.",
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

  async function handleDelete() {
    const confirmationMessage = [
      `Tem certeza de que deseja remover o usuário "${user.username}"?`,
      "Essa ação não poderá ser desfeita.",
    ].join(" ");
    const confirmed = window.confirm(confirmationMessage);
    if (!confirmed) return;

    setIsDeleting(true);
    setFeedback(null);

    try {
      await requestAPI(
        `/api/v1/admin/users/${encodeURIComponent(user.username)}`,
        { method: "DELETE" },
      );
      onDeleted(user.id);
    } catch (requestError) {
      setFeedback({
        type: "error",
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className={styles.editor} aria-label="Editar usuário">
      <div className={styles.sectionHeading}>
        <div>
          <h2>Dados do usuário</h2>
          <span>Altere os campos desejados e salve as alterações.</span>
        </div>
        <span className={styles.userId}>ID: {user.id}</span>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={shared.label} htmlFor="edit-username">
              Nome de usuário
            </label>
            <input
              className={shared.input}
              id="edit-username"
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              disabled={isSaving || isDeleting}
            />
          </div>
          <div className={styles.field}>
            <label className={shared.label} htmlFor="edit-email">
              E-mail
            </label>
            <input
              className={shared.input}
              id="edit-email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              disabled={isSaving || isDeleting}
            />
          </div>
        </div>

        <div className={styles.passwordSection}>
          <h3>Alterar senha</h3>
          <p>Deixe os campos em branco para manter a senha atual.</p>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={shared.label} htmlFor="edit-password">
                Nova senha
              </label>
              <input
                className={shared.input}
                id="edit-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
                disabled={isSaving || isDeleting}
              />
            </div>
            <div className={styles.field}>
              <label
                className={shared.label}
                htmlFor="edit-password-confirmation"
              >
                Confirmar nova senha
              </label>
              <input
                className={shared.input}
                id="edit-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={form.passwordConfirmation}
                onChange={(event) =>
                  updateField("passwordConfirmation", event.target.value)
                }
                disabled={isSaving || isDeleting}
              />
            </div>
          </div>
        </div>

        <div className={styles.featureSection}>
          <div className={styles.sectionHeading}>
            <div>
              <h3>Permissões e features</h3>
              <span>
                Selecione as permissões que esta conta poderá utilizar.
              </span>
            </div>
            <span className={styles.featureCount}>
              {form.features.length} selecionada(s)
            </span>
          </div>

          <input
            className={shared.input}
            type="search"
            aria-label="Pesquisar features"
            placeholder="Pesquisar por nome ou descrição da feature"
            value={featureSearch}
            onChange={(event) => setFeatureSearch(event.target.value)}
            disabled={isSaving || isDeleting}
          />

          {featureGroups.map((group) => {
            const groupFeatures = filteredFeatures.filter(
              (feature) => feature.group === group,
            );
            if (groupFeatures.length === 0) return null;

            return (
              <div className={styles.featureGroup} key={group}>
                <h4>{group}</h4>
                <div className={styles.featureList}>
                  {groupFeatures.map((feature) => (
                    <label className={styles.featureOption} key={feature.name}>
                      <input
                        type="checkbox"
                        checked={form.features.includes(feature.name)}
                        onChange={() => toggleFeature(feature.name)}
                        disabled={isSaving || isDeleting}
                      />
                      <span
                        className={styles.switch}
                        aria-hidden="true"
                      ></span>
                      <span className={styles.featureText}>
                        <strong>{feature.label}</strong>
                        <small>{feature.description}</small>
                        <code>{feature.name}</code>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredFeatures.length === 0 && (
            <p className={styles.emptyFeatures}>
              Nenhuma feature corresponde à pesquisa.
            </p>
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

        <div className={styles.formActions}>
          <Button
            type="submit"
            icon="fa-save"
            disabled={isSaving || isDeleting}
          >
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button
            type="button"
            variant="danger"
            icon="fa-times"
            onClick={handleCancel}
            disabled={isSaving || isDeleting}
          >
            Cancelar
          </Button>
        </div>
      </form>

      <div className={styles.dangerZone}>
        <div>
          <strong>Remover usuário</strong>
          <small>
            Remove a conta e encerra todas as sessões e tokens de ativação
            associados.
          </small>
        </div>
        <Button
          type="button"
          variant="danger"
          icon="fa-trash"
          onClick={handleDelete}
          disabled={isSaving || isDeleting || user.id === currentUserId}
        >
          {isDeleting ? "Removendo..." : "Remover"}
        </Button>
        {user.id === currentUserId && (
          <small className={styles.hint}>
            Você não pode remover a própria conta por este painel.
          </small>
        )}
      </div>
    </section>
  );
}

export default AdminUsersPage;
