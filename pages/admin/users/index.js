import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";

import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/shared/user-validation.js";
import {
  hasAdminAccess,
  hasAdminSectionAccess,
} from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function AdminUsersPage() {
  const router = useRouter();
  const { user, error, isLoading, setUser } = useUser();
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
    if (!isLoading && user && !hasAdminSectionAccess(user, "users")) {
      if (hasAdminAccess(user)) {
        router.replace("/admin");
      } else {
        router.replace("/perfil");
      }
    }
  }, [error, isLoading, router, user]);

  useEffect(() => {
    if (feedback?.type !== "success") return undefined;

    const timeoutId = setTimeout(() => {
      setFeedback((currentFeedback) =>
        currentFeedback?.type === "success" ? null : currentFeedback,
      );
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [feedback]);

  async function handleSearch(event) {
    event.preventDefault();
    const normalizedSearch = searchTerm.trim();

    if (normalizedSearch.length < 2) {
      setFeedback((current) => ({
        id: (current?.id ?? 0) + 1,
        type: "error",
        message: "Informe ao menos dois caracteres para pesquisar.",
      }));
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
      setFeedback((current) => ({
        id: (current?.id ?? 0) + 1,
        type: "error",
        name: requestError.statusCode ? requestError.name : undefined,
        message: requestError.message,
        action: requestError.action,
      }));
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
      setFeedback((current) => ({
        id: (current?.id ?? 0) + 1,
        type: "error",
        name: requestError.statusCode ? requestError.name : undefined,
        message: requestError.message,
        action: requestError.action,
      }));
    }
  }

  useEffect(() => {
    const username = router.query.username;

    if (
      !router.isReady ||
      typeof username !== "string" ||
      !user ||
      !hasAdminSectionAccess(user, "users")
    ) {
      return undefined;
    }

    let active = true;

    setSearchTerm(username);

    requestAPI(`/api/v1/admin/users/${encodeURIComponent(username)}`)
      .then((foundUser) => {
        if (active) setSelectedUser(foundUser);
      })
      .catch((requestError) => {
        if (!active) return;

        setFeedback({
          type: "error",
          name: requestError.statusCode ? requestError.name : undefined,
          message: requestError.message,
          action: requestError.action,
        });
      });

    return () => {
      active = false;
    };
  }, [router.isReady, router.query.username, user]);

  async function handleBanStatusChanged(updatedUser, successMessage) {
    setSelectedUser(updatedUser);
    setResults((currentResults) =>
      currentResults.map((result) =>
        result.id === updatedUser.id
          ? {
              ...result,
              banned_at: updatedUser.banned_at,
              timeout_until: updatedUser.timeout_until,
            }
          : result,
      ),
    );
    setFeedback({
      type: "success",
      message:
        successMessage ||
        (updatedUser.banned_at
          ? "Usuário banido com sucesso."
          : "Usuário desbanido com sucesso."),
    });
  }

  async function handleUserUpdated(updatedUser) {
    setSelectedUser(null);
    setIsSearching(true);
    setFeedback(null);

    try {
      if (updatedUser.id === user.id) {
        setUser(updatedUser);

        if (!hasAdminSectionAccess(updatedUser, "users")) {
          router.replace(hasAdminAccess(updatedUser) ? "/admin" : "/perfil");
          return;
        }
      }

      const refreshedUsers = await requestAPI(
        `/api/v1/admin/users?search=${encodeURIComponent(searchTerm.trim())}`,
      );
      setResults(refreshedUsers);
      setFeedback({
        type: "success",
        message: "Alterações salvas e lista de usuários atualizada.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.statusCode ? requestError.name : undefined,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsSearching(false);
    }
  }

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Gerenciar usuários" />
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
        <AppHead title="Gerenciar usuários" />
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

  if (!user || !hasAdminSectionAccess(user, "users")) {
    return null;
  }

  return (
    <>
      <AppHead
        title="Gerenciar usuários"
        description="Pesquise e gerencie contas e permissões de usuários."
      />
      <Layout>
        <main className={`${shared.container} ${shared.containerUltraWide}`}>
          <section
            className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
          >
            <AdminBackButton />

            <header className={styles.pageHeader}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-users-cog"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>Gerenciar usuários</h1>
              <p className={styles.description}>
                Pesquise por nome de usuário ou e-mail para consultar e alterar
                os dados e as permissões de uma conta.
              </p>
            </header>

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
              <StatusMessage
                type={feedback.type}
                name={feedback.name}
                action={feedback.action}
                resetKey={feedback}
              >
                {feedback.message}
              </StatusMessage>
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
                          {result.profile_photo_url ? (
                            <Image
                              src={result.profile_photo_url}
                              alt=""
                              width={40}
                              height={40}
                              unoptimized
                            />
                          ) : (
                            result.username.slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <span className={styles.userIdentity}>
                          <span className={styles.userIdentityHeading}>
                            <strong>{result.username}</strong>
                            <span
                              className={`${styles.userStatusBadge} ${
                                result.banned_at
                                  ? styles.userStatusBanned
                                  : result.timeout_until &&
                                      new Date(result.timeout_until) > new Date()
                                    ? styles.userStatusTimeout
                                    : styles.userStatusActive
                              }`}
                            >
                              {result.banned_at
                                ? "Banido"
                                : result.timeout_until &&
                                    new Date(result.timeout_until) > new Date()
                                  ? "Em timeout"
                                  : "Ativo"}
                            </span>
                          </span>
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
                onBanStatusChanged={handleBanStatusChanged}
                canManageUserStatus={user.features.includes("update:user:status")}
                canManageUserFeatures={user.features.includes("update:user:features")}
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
  onBanStatusChanged,
  canManageUserStatus,
  canManageUserFeatures,
  onCancel,
}) {
  const isEditingSelf = user.id === currentUserId;
  const [form, setForm] = useState({
    username: user.username,
    email: user.email,
    password: "",
    passwordConfirmation: "",
    features: [...user.features],
  });
  const [featureSearch, setFeatureSearch] = useState("");
  const [privilegedOnly, setPrivilegedOnly] = useState(false);
  const [protectedOnly, setProtectedOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingBan, setIsUpdatingBan] = useState(false);
  const [isUpdatingTimeout, setIsUpdatingTimeout] = useState(false);
  const [isTimeoutModalOpen, setIsTimeoutModalOpen] = useState(false);
  const [timeoutMode, setTimeoutMode] = useState("duration");
  const [timeoutAmount, setTimeoutAmount] = useState("1");
  const [timeoutUnit, setTimeoutUnit] = useState("hours");
  const [timeoutDate, setTimeoutDate] = useState(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [feedback, setFeedback] = useState(null);
  const [features, setFeatures] = useState([]);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(
    canManageUserFeatures,
  );

  useEffect(() => {
    if (!canManageUserFeatures) return undefined;

    let isMounted = true;

    requestAPI("/api/v1/admin/users/features")
      .then((availableFeatures) => {
        if (isMounted) setFeatures(availableFeatures);
      })
      .catch((requestError) => {
        if (!isMounted) return;
        setFeedback({
          type: "error",
          name: requestError.statusCode ? requestError.name : undefined,
          message: requestError.message,
          action: requestError.action,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoadingFeatures(false);
      });

    return () => {
      isMounted = false;
    };
  }, [canManageUserFeatures]);

  const featureGroups = useMemo(
    () =>
      [...new Set(features.map((feature) => feature.group_name))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [features],
  );

  const filteredFeatures = useMemo(() => {
    const term = featureSearch.trim().toLowerCase();
    return features.filter(
      (feature) =>
        (!privilegedOnly || feature.is_privileged) &&
        (!protectedOnly || feature.is_protected) &&
        (!term ||
          feature.name.toLowerCase().includes(term) ||
          feature.label.toLowerCase().includes(term) ||
          feature.description.toLowerCase().includes(term)),
    );
  }, [featureSearch, features, privilegedOnly, protectedOnly]);

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
    setPrivilegedOnly(false);
    setProtectedOnly(false);
    setFeedback(null);
    onCancel();
  }

  async function handleToggleBan() {
    if (
      !canManageUserStatus ||
      isEditingSelf ||
      isUpdatingBan ||
      isSaving
    )
      return;

    const isBanned = Boolean(user.banned_at);
    setIsUpdatingBan(true);
    setFeedback(null);

    try {
      const updatedUser = await requestAPI(
        `/api/v1/admin/users/${encodeURIComponent(user.username)}/ban`,
        { method: isBanned ? "DELETE" : "POST" },
      );
      await onBanStatusChanged(updatedUser);
    } catch (requestError) {
      setFeedback((current) => ({
        id: (current?.id ?? 0) + 1,
        type: "error",
        name: requestError.statusCode ? requestError.name : undefined,
        message: requestError.message,
        action: requestError.action,
      }));
    } finally {
      setIsUpdatingBan(false);
    }
  }

  function handleOpenTimeoutModal() {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setTimeoutDate(
      new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
    setFeedback(null);
    setIsTimeoutModalOpen(true);
  }

  async function handleTimeoutSubmit(event) {
    event.preventDefault();
    if (
      !canManageUserStatus ||
      isEditingSelf ||
      isUpdatingTimeout ||
      user.banned_at
    ) return;

    let expiresAt;
    if (timeoutMode === "date") {
      expiresAt = new Date(timeoutDate);
    } else {
      const amount = Number(timeoutAmount);
      if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
        setFeedback({
          type: "error",
          message: "Informe uma quantidade inteira entre 1 e 10.000.",
        });
        return;
      }

      expiresAt = new Date();
      if (timeoutUnit === "hours") {
        expiresAt.setHours(expiresAt.getHours() + amount);
      } else if (timeoutUnit === "days") {
        expiresAt.setDate(expiresAt.getDate() + amount);
      } else {
        const day = expiresAt.getDate();
        expiresAt.setDate(1);
        expiresAt.setMonth(expiresAt.getMonth() + amount);
        const lastDay = new Date(
          expiresAt.getFullYear(),
          expiresAt.getMonth() + 1,
          0,
        ).getDate();
        expiresAt.setDate(Math.min(day, lastDay));
      }
    }

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      setFeedback({
        type: "error",
        message: "Informe uma data e hora futuras para o timeout.",
      });
      return;
    }

    setIsUpdatingTimeout(true);
    setFeedback(null);
    try {
      const updatedUser = await requestAPI(
        "/api/v1/admin/users/" + encodeURIComponent(user.username) + "/timeout",
        {
          method: "POST",
          body: JSON.stringify({ timeout_until: expiresAt.toISOString() }),
        },
      );
      setIsTimeoutModalOpen(false);
      await onBanStatusChanged(
        updatedUser,
        "Timeout aplicado com sucesso. As sessões anteriores foram encerradas.",
      );
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.statusCode ? requestError.name : undefined,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsUpdatingTimeout(false);
    }
  }

  async function handleRemoveTimeout() {
    if (!canManageUserStatus || isEditingSelf || isUpdatingTimeout) return;

    setIsUpdatingTimeout(true);
    setFeedback(null);
    try {
      const updatedUser = await requestAPI(
        "/api/v1/admin/users/" + encodeURIComponent(user.username) + "/timeout",
        { method: "DELETE" },
      );
      setIsTimeoutModalOpen(false);
      await onBanStatusChanged(
        updatedUser,
        "Timeout removido. O usuário poderá entrar novamente, mas precisará fazer login.",
      );
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.statusCode ? requestError.name : undefined,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsUpdatingTimeout(false);
    }
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

    if (canManageUserFeatures) {
      const currentFeatures = [...user.features].sort();
      const nextFeatures = [...new Set(form.features)].sort();
      if (JSON.stringify(currentFeatures) !== JSON.stringify(nextFeatures)) {
        payload.features = nextFeatures;
      }
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
      await onUpdated(updatedUser);
    } catch (requestError) {
      setFeedback((current) => ({
        id: (current?.id ?? 0) + 1,
        type: "error",
        name: requestError.statusCode ? requestError.name : undefined,
        message: requestError.message,
        action: requestError.action,
      }));
    } finally {
      setIsSaving(false);
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

      {canManageUserStatus && (
        <div className={styles.banActions}>
          <Button
            variant={user.banned_at ? "success" : "danger"}
            icon={user.banned_at ? "fa-unlock" : "fa-ban"}
            onClick={handleToggleBan}
            disabled={
              isEditingSelf || isSaving || isUpdatingBan || isUpdatingTimeout
            }
          >
            {isUpdatingBan
              ? user.banned_at
                ? "Desbanindo..."
                : "Banindo..."
              : user.banned_at
                ? "Desbanir usuário"
                : "Banir usuário"}
          </Button>
          <Button
            variant="outline"
            icon="fa-clock"
            onClick={handleOpenTimeoutModal}
            disabled={
              isEditingSelf ||
              isSaving ||
              isUpdatingBan ||
              isUpdatingTimeout ||
              Boolean(user.banned_at) &&
              !(user.timeout_until && new Date(user.timeout_until) > new Date())
            }
          >
            {user.timeout_until && new Date(user.timeout_until) > new Date()
              ? "Gerenciar timeout"
              : "Aplicar timeout"}
          </Button>
          {isEditingSelf && (
            <small>
              Não é permitido banir ou aplicar timeout à própria conta administrativa.
            </small>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {user.profile_photo_url && (
          <div className={styles.profilePhoto}>
            <Image
              src={user.profile_photo_url}
              alt={`Foto de perfil de ${user.username}`}
              width={88}
              height={88}
              unoptimized
            />
            <div>
              <strong>Foto de perfil</strong>
              <small>A imagem atual desta conta.</small>
              <Button
                type="button"
                variant="danger"
                icon="fa-trash"
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  setFeedback(null);
                  try {
                    const updatedUser = await requestAPI(
                      `/api/v1/admin/users/${encodeURIComponent(user.username)}/photo`,
                      { method: "DELETE" },
                    );
                    await onUpdated(updatedUser);
                  } catch (requestError) {
                    setFeedback({
                      type: "error",
                      name: requestError.statusCode
                        ? requestError.name
                        : undefined,
                      message: requestError.message,
                      action: requestError.action,
                    });
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                Remover foto de perfil
              </Button>
            </div>
          </div>
        )}
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
              disabled={isSaving}
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
              disabled={isSaving}
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
                disabled={isSaving}
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
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="submit" icon="fa-save" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button
            type="button"
            variant="danger"
            icon="fa-times"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancelar
          </Button>
        </div>

        {canManageUserFeatures && (
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
  
            {isLoadingFeatures && <p>Carregando permissões disponíveis...</p>}
  
            <input
              className={shared.input}
              type="search"
              aria-label="Pesquisar features"
              placeholder="Pesquisar por nome ou descrição da feature"
              value={featureSearch}
              onChange={(event) => setFeatureSearch(event.target.value)}
              disabled={isSaving}
            />
  
            <div className={styles.searchFilters}>
              <label className={styles.filterSwitch}>
                <input
                  type="checkbox"
                  checked={privilegedOnly}
                  onChange={(event) => setPrivilegedOnly(event.target.checked)}
                  disabled={isSaving}
                />
                <span className={styles.switch} aria-hidden="true"></span>
                <span>Privilegiadas</span>
              </label>
              <label className={styles.filterSwitch}>
                <input
                  type="checkbox"
                  checked={protectedOnly}
                  onChange={(event) => setProtectedOnly(event.target.checked)}
                  disabled={isSaving}
                />
                <span className={styles.switch} aria-hidden="true"></span>
                <span>Protegidas</span>
              </label>
            </div>
  
            <div className={styles.featureGroups}>
              {featureGroups.map((group) => {
                const groupFeatures = filteredFeatures.filter(
                  (feature) => feature.group_name === group,
                );
                if (groupFeatures.length === 0) return null;
  
                return (
                  <div className={styles.featureGroup} key={group}>
                    <h4>{group}</h4>
                    <div className={styles.featureList}>
                      {groupFeatures.map((feature) => {
                        const isLockedForSelf =
                          isEditingSelf && feature.is_self_removable === false;
  
                        return (
                          <label
                            className={`${styles.featureOption} ${
                              isLockedForSelf ? styles.featureOptionLocked : ""
                            } ${
                              feature.is_privileged ||
                              feature.is_protected ||
                              feature.is_self_removable === false
                                ? styles.featureOptionBadged
                                : ""
                            }`}
                            key={feature.name}
                            title={
                              isLockedForSelf &&
                              form.features.includes(feature.name)
                                ? "Esta feature não pode ser removida pelo próprio usuário"
                                : undefined
                            }
                          >
                            <span className={styles.featureBadges}>
                              {feature.is_privileged && (
                                <span
                                  className={`${styles.featureBadge} ${styles.privilegedBadge}`}
                                  title="Permissão privilegiada"
                                  role="img"
                                  aria-label="Permissão privilegiada"
                                >
                                  <i
                                    className="fas fa-crown"
                                    aria-hidden="true"
                                  ></i>
                                </span>
                              )}
                              {feature.is_protected && (
                                <span
                                  className={`${styles.featureBadge} ${styles.protectedFeatureBadge}`}
                                  title="Feature protegida: não pode ser alterada ou excluída"
                                  role="img"
                                  aria-label="Feature protegida"
                                >
                                  <i
                                    className="fas fa-shield-alt"
                                    aria-hidden="true"
                                  ></i>
                                </span>
                              )}
                              {feature.is_self_removable === false && (
                                <span
                                  className={`${styles.featureBadge} ${styles.protectedBadge}`}
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
                            </span>
                            <input
                              type="checkbox"
                              checked={form.features.includes(feature.name)}
                              onChange={() => toggleFeature(feature.name)}
                              disabled={
                                isSaving ||
                                (isLockedForSelf &&
                                  form.features.includes(feature.name))
                              }
                            />
                            <span
                              className={`${styles.switch} ${
                                isLockedForSelf ? styles.switchLocked : ""
                              }`}
                              aria-hidden="true"
                            ></span>
                            <span className={styles.featureText}>
                              <strong>{feature.label}</strong>
                              <small>{feature.description}</small>
                              <code>{feature.name}</code>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
  
            {filteredFeatures.length === 0 && (
              <p className={styles.emptyFeatures}>
                Nenhuma feature corresponde à pesquisa ou aos filtros.
              </p>
            )}
          </div>
        )}

        {feedback &&
          (feedback.type === "critical" ? (
            <StatusMessage
              type="critical"
              name={feedback.name}
              action={feedback.action}
            >
              {feedback.message}
            </StatusMessage>
          ) : (
            <div className={styles.feedback} role="status">
              <StatusMessage
                type="inline-error"
                name={feedback.name}
                action={feedback.action}
              >
                {feedback.message}
              </StatusMessage>
            </div>
          ))}

        <div className={styles.formActions}>
          <Button type="submit" icon="fa-save" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button
            type="button"
            variant="danger"
            icon="fa-times"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancelar
          </Button>
        </div>
      </form>

      {isTimeoutModalOpen && (
        <Modal
          title="Gerenciar timeout"
          onClose={() => {
            if (!isUpdatingTimeout) setIsTimeoutModalOpen(false);
          }}
          closeOnBackdrop={!isUpdatingTimeout}
          closeOnEscape={!isUpdatingTimeout}
        >
          {user.timeout_until && new Date(user.timeout_until) > new Date() && (
            <div className={styles.timeoutCurrent}>
              <strong>Timeout ativo</strong>
              <span>
                Acesso suspenso até{" "}
                {new Date(user.timeout_until).toLocaleString("pt-BR")}
              </span>
            </div>
          )}

          <form className={styles.timeoutForm} onSubmit={handleTimeoutSubmit}>
            <p>
              O usuário ficará sem acesso até o prazo escolhido. As sessões
              atuais serão encerradas e não serão reativadas automaticamente.
              {user.banned_at &&
                " A conta também está banida; o timeout poderá ser removido, mas o banimento continuará ativo."}
            </p>

            <div className={styles.timeoutMode}>
              <label>
                <input
                  type="radio"
                  name="timeout-mode"
                  value="duration"
                  checked={timeoutMode === "duration"}
                  onChange={() => setTimeoutMode("duration")}
                  disabled={isUpdatingTimeout}
                />
                Por duração
              </label>
              <label>
                <input
                  type="radio"
                  name="timeout-mode"
                  value="date"
                  checked={timeoutMode === "date"}
                  onChange={() => setTimeoutMode("date")}
                  disabled={isUpdatingTimeout}
                />
                Até uma data
              </label>
            </div>

            {timeoutMode === "duration" ? (
              <div className={styles.timeoutDuration}>
                <div className={styles.field}>
                  <label className={shared.label} htmlFor="timeout-amount">
                    Quantidade
                  </label>
                  <input
                    className={shared.input}
                    id="timeout-amount"
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={timeoutAmount}
                    onChange={(event) => setTimeoutAmount(event.target.value)}
                    disabled={isUpdatingTimeout}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={shared.label} htmlFor="timeout-unit">
                    Unidade
                  </label>
                  <select
                    className={shared.input}
                    id="timeout-unit"
                    value={timeoutUnit}
                    onChange={(event) => setTimeoutUnit(event.target.value)}
                    disabled={isUpdatingTimeout}
                  >
                    <option value="hours">Horas</option>
                    <option value="days">Dias</option>
                    <option value="months">Meses</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className={styles.field}>
                <label className={shared.label} htmlFor="timeout-date">
                  Data e hora para liberar o acesso
                </label>
                <input
                  className={shared.input}
                  id="timeout-date"
                  type="datetime-local"
                  value={timeoutDate}
                  onChange={(event) => setTimeoutDate(event.target.value)}
                  disabled={isUpdatingTimeout}
                  required
                />
              </div>
            )}

            {feedback?.type === "error" && (
              <div className={styles.timeoutFeedback}>
                <StatusMessage
                  type="inline-error"
                  name={feedback.name}
                  action={feedback.action}
                >
                  {feedback.message}
                </StatusMessage>
              </div>
            )}

            <div className={styles.timeoutActions}>
              <Button
                type="submit"
                icon="fa-clock"
                disabled={isUpdatingTimeout || Boolean(user.banned_at)}
              >
                {isUpdatingTimeout ? "Aplicando..." : "Aplicar timeout"}
              </Button>
              {user.timeout_until && new Date(user.timeout_until) > new Date() && (
                <Button
                  type="button"
                  variant="danger"
                  icon="fa-unlock"
                  onClick={handleRemoveTimeout}
                  disabled={isUpdatingTimeout}
                >
                  Remover timeout
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTimeoutModalOpen(false)}
                disabled={isUpdatingTimeout}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

export default AdminUsersPage;
