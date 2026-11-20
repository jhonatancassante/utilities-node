import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "@/lib/shared/user-validation.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function ProfilePage() {
  const router = useRouter();
  const { user, error, isLoading, setUser } = useUser();

  useEffect(() => {
    if (!isLoading && !user && !error) router.replace("/login");
  }, [error, isLoading, router, user]);

  return (
    <>
      <AppHead
        title="Meu perfil"
        description="Consulte e atualize os dados da sua conta."
      />
      <Layout>
        <main className={shared.container}>
          {isLoading || (!user && !error) ? (
            <section
              className={`${shared.card} ${styles.card}`}
              aria-live="polite"
            >
              <p>Carregando seus dados...</p>
            </section>
          ) : error ? (
            <section className={`${shared.card} ${styles.card}`}>
              <StatusMessage
                type="critical"
                name={error.statusCode ? error.name : undefined}
                action={error.action}
              >
                {error.statusCode
                  ? error.message
                  : "Não foi possível carregar os dados da sua conta."}
              </StatusMessage>
            </section>
          ) : user ? (
            <ProfileForm key={user.id} user={user} onUpdated={setUser} />
          ) : null}
        </main>
      </Layout>
    </>
  );
}

function ProfileForm({ user, onUpdated }) {
  const [form, setForm] = useState({
    username: user.username,
    email: user.email,
    password: "",
    passwordConfirmation: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [touched, setTouched] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const errors = {
    username: validateUsername(form.username.trim())?.message ?? "",
    email: validateEmail(form.email.trim())?.message ?? "",
    password: form.password
      ? (validatePassword(form.password)?.message ?? "")
      : "",
    passwordConfirmation:
      !form.password && form.passwordConfirmation
        ? "Informe a nova senha antes de confirmá-la."
        : form.password && !form.passwordConfirmation
          ? "Confirme a nova senha."
          : form.password && form.password !== form.passwordConfirmation
            ? "As senhas informadas não coincidem."
            : "",
  };

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFeedback(null);
  }

  function handleBlur(name) {
    setTouched((current) => ({ ...current, [name]: true }));
  }

  function handleEdit(event) {
    event.preventDefault();

    setForm({
      username: user.username,
      email: user.email,
      password: "",
      passwordConfirmation: "",
    });

    setTouched({});
    setFeedback(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      passwordConfirmation: "",
    });
    setTouched({});
    setFeedback(null);
    setShowPassword(false);
    setShowPasswordConfirmation(false);
    setIsEditing(false);
  }

  function renderError(name) {
    if (!isEditing || !touched[name] || !errors[name]) return null;

    return (
      <small className={styles.fieldError} id={`${name}-error`} role="alert">
        {errors[name]}
      </small>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setTouched({
      username: true,
      email: true,
      password: true,
      passwordConfirmation: true,
    });

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
      setFeedback(null);
      return;
    }

    const payload = {};

    if (form.username.trim() !== user.username) {
      payload.username = form.username.trim();
    }
    if (form.email.trim() !== user.email) {
      payload.email = form.email.trim();
    }
    if (form.password) {
      payload.password = form.password;
    }

    if (Object.keys(payload).length === 0) {
      handleCancel();
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await requestAPI(`/api/v1/users/${encodeURIComponent(user.username)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const updatedUser = {
        ...user,
        username: payload.username ?? user.username,
        email: payload.email ?? user.email,
      };

      onUpdated(updatedUser);
      setForm({
        username: updatedUser.username,
        email: updatedUser.email,
        password: "",
        passwordConfirmation: "",
      });
      setTouched({});
      setShowPassword(false);
      setShowPasswordConfirmation(false);
      setIsEditing(false);
    } catch (error) {
      setFeedback({
        type: "error",
        name: error.statusCode ? error.name : undefined,
        message: error.message,
        action: error.action,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={`${shared.card} ${styles.card}`}>
      <div className={shared.icon} aria-hidden="true">
        <i className="fas fa-user"></i>
      </div>
      <span className={shared.badge}>MINHA CONTA</span>
      <h1>Meu perfil</h1>
      <p className={styles.description}>
        {isEditing
          ? "Atualize as informações da sua conta."
          : "Confira as informações da sua conta."}
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={shared.label} htmlFor="username">
            Nome de usuário
          </label>
          <input
            className={`${shared.input} ${isEditing && touched.username && errors.username ? styles.invalidInput : ""}`}
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={form.username}
            onChange={handleChange}
            onBlur={() => handleBlur("username")}
            aria-invalid={Boolean(
              isEditing && touched.username && errors.username,
            )}
            disabled={!isEditing || isSubmitting}
          />
          {renderError("username")}
          {isEditing && (
            <small className={styles.fieldHint}>
              De 3 a 30 caracteres. Letras sem acento, números, hífen e
              sublinhado.
            </small>
          )}
        </div>

        <div className={styles.field}>
          <label className={shared.label} htmlFor="email">
            E-mail
          </label>
          <input
            className={`${shared.input} ${isEditing && touched.email && errors.email ? styles.invalidInput : ""}`}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            onBlur={() => handleBlur("email")}
            aria-invalid={Boolean(isEditing && touched.email && errors.email)}
            disabled={!isEditing || isSubmitting}
          />
          {renderError("email")}
        </div>

        {isEditing && (
          <>
            <div className={styles.divider}>
              <span>Alterar senha</span>
              <small>Deixe em branco se não quiser trocar sua senha.</small>
            </div>

            <div className={styles.field}>
              <label className={shared.label} htmlFor="password">
                Nova senha
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  className={`${shared.input} ${styles.passwordInput} ${touched.password && errors.password ? styles.invalidInput : ""}`}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  onBlur={() => handleBlur("password")}
                  aria-invalid={Boolean(touched.password && errors.password)}
                  disabled={isSubmitting}
                />
                <button
                  className={styles.passwordToggle}
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={isSubmitting}
                >
                  <i
                    className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
              {renderError("password")}
              <small className={styles.fieldHint}>
                De 12 a 64 caracteres, com pelo menos 2 letras minúsculas, 2
                maiúsculas, 2 números e 2 caracteres especiais.
              </small>
            </div>

            <div className={styles.field}>
              <label className={shared.label} htmlFor="passwordConfirmation">
                Confirmar nova senha
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  className={`${shared.input} ${styles.passwordInput} ${touched.passwordConfirmation && errors.passwordConfirmation ? styles.invalidInput : ""}`}
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  type={showPasswordConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.passwordConfirmation}
                  onChange={handleChange}
                  onBlur={() => handleBlur("passwordConfirmation")}
                  aria-invalid={Boolean(
                    touched.passwordConfirmation && errors.passwordConfirmation,
                  )}
                  disabled={isSubmitting}
                />
                <button
                  className={styles.passwordToggle}
                  type="button"
                  aria-label={
                    showPasswordConfirmation
                      ? "Ocultar confirmação da senha"
                      : "Mostrar confirmação da senha"
                  }
                  aria-pressed={showPasswordConfirmation}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    setShowPasswordConfirmation((visible) => !visible)
                  }
                  disabled={isSubmitting}
                >
                  <i
                    className={`fas ${showPasswordConfirmation ? "fa-eye-slash" : "fa-eye"}`}
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
              {renderError("passwordConfirmation")}
            </div>
          </>
        )}

        {feedback && (
          <div className={styles.feedback} role="alert">
            <StatusMessage
              type="inline-error"
              name={feedback.name}
              action={feedback.action}
            >
              {feedback.message}
            </StatusMessage>
          </div>
        )}

        <div className={styles.formActions}>
          {isEditing ? (
            <>
              <Button
                key="save"
                type="submit"
                icon="fa-save"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>

              <Button
                key="cancel"
                type="button"
                variant="danger"
                icon="fa-times"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              key="edit"
              type="button"
              icon="fa-edit"
              onClick={handleEdit}
            >
              Editar informações
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

export default ProfilePage;
