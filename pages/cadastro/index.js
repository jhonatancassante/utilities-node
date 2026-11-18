// pages/cadastro/index.js
import { useState } from "react";
import Link from "next/link";

import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import requestAPI from "@/lib/api.js";
import {
  validateUsername,
  validateEmail,
  validatePassword,
} from "@/lib/user-validation.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const INITIAL_FORM = {
  username: "",
  email: "",
  password: "",
  passwordConfirmation: "",
};

const INITIAL_TOUCHED = {
  username: false,
  email: false,
  password: false,
  passwordConfirmation: false,
};

function getFieldErrors(form) {
  return {
    username: validateUsername(form.username.trim())?.message ?? "",
    email: validateEmail(form.email.trim())?.message ?? "",
    password: validatePassword(form.password)?.message ?? "",
    passwordConfirmation: !form.passwordConfirmation
      ? "A confirmação da senha é obrigatória."
      : form.password !== form.passwordConfirmation
        ? "As senhas informadas não coincidem."
        : "",
  };
}

function RegistrationPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState(INITIAL_TOUCHED);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const fieldErrors = getFieldErrors(form);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
    setFeedback(null);
  }

  function handleBlur(name) {
    setTouched((currentTouched) => ({
      ...currentTouched,
      [name]: true,
    }));
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
      validatePassword(form.password) ||
      (!form.passwordConfirmation
        ? {
            message: "A confirmação da senha é obrigatória.",
          }
        : form.password !== form.passwordConfirmation
          ? {
              message: "As senhas informadas não coincidem.",
            }
          : null);

    if (validationError) {
      setFeedback(null);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await requestAPI("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      setRegisteredEmail(form.email.trim());
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message,
        action: error.action,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderFieldError(name) {
    if (!touched[name] || !fieldErrors[name]) {
      return null;
    }

    return (
      <small className={styles.fieldError} id={`${name}-error`} role="alert">
        {fieldErrors[name]}
      </small>
    );
  }

  return (
    <>
      <AppHead
        title="Criar conta"
        description="Crie sua conta para utilizar os recursos do Utilities."
      />

      <Layout>
        <main className={shared.container}>
          <section className={`${shared.card} ${styles.card}`}>
            {registeredEmail ? (
              <RegistrationSuccess email={registeredEmail} />
            ) : (
              <>
                <div className={shared.icon} aria-hidden="true">
                  <i className="fas fa-user-plus"></i>
                </div>

                <span className={shared.badge}>NOVA CONTA</span>
                <h1>Criar conta</h1>
                <p className={styles.description}>
                  Preencha os dados abaixo para criar sua conta no Utilities.
                </p>

                <form
                  className={styles.form}
                  onSubmit={handleSubmit}
                  noValidate
                >
                  <div className={styles.field}>
                    <label className={shared.label} htmlFor="username">
                      Nome de usuário
                    </label>
                    <input
                      className={`${shared.input} ${touched.username && fieldErrors.username ? styles.invalidInput : ""}`}
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="Como deseja ser identificado?"
                      value={form.username}
                      onChange={handleChange}
                      onBlur={() => handleBlur("username")}
                      aria-invalid={Boolean(
                        touched.username && fieldErrors.username,
                      )}
                      aria-describedby={
                        touched.username && fieldErrors.username
                          ? "username-error"
                          : "username-hint"
                      }
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={isSubmitting}
                    />
                    {renderFieldError("username")}
                    <small className={styles.fieldHint} id="username-hint">
                      De 3 a 30 caracteres. Letras, números, hífen (-) e
                      sublinhado (_).
                    </small>
                  </div>

                  <div className={styles.field}>
                    <label className={shared.label} htmlFor="email">
                      E-mail
                    </label>
                    <input
                      className={`${shared.input} ${touched.email && fieldErrors.email ? styles.invalidInput : ""}`}
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                      value={form.email}
                      onChange={handleChange}
                      onBlur={() => handleBlur("email")}
                      aria-invalid={Boolean(touched.email && fieldErrors.email)}
                      aria-describedby={
                        touched.email && fieldErrors.email
                          ? "email-error"
                          : "email-hint"
                      }
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={isSubmitting}
                    />
                    {renderFieldError("email")}
                    <small className={styles.fieldHint} id="email-hint">
                      Endereço de e-mail válido, com até 254 caracteres.
                    </small>
                  </div>

                  <div className={styles.field}>
                    <label className={shared.label} htmlFor="password">
                      Senha
                    </label>
                    <div className={styles.passwordWrapper}>
                      <input
                        className={`${shared.input} ${styles.passwordInput} ${touched.password && fieldErrors.password ? styles.invalidInput : ""}`}
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Crie uma senha com pelo menos 12 caracteres"
                        value={form.password}
                        onChange={handleChange}
                        onBlur={() => handleBlur("password")}
                        aria-invalid={Boolean(
                          touched.password && fieldErrors.password,
                        )}
                        aria-describedby={
                          touched.password && fieldErrors.password
                            ? "password-error"
                            : "password-hint"
                        }
                        disabled={isSubmitting}
                      />
                      <button
                        className={styles.passwordToggle}
                        type="button"
                        aria-label={
                          showPassword ? "Ocultar senha" : "Mostrar senha"
                        }
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
                    {renderFieldError("password")}
                    <small className={styles.fieldHint} id="password-hint">
                      De 12 a 64 caracteres, com pelo menos 2 letras minúsculas, 2
                      maiúsculas, 2 números e 2 caracteres especiais.
                    </small>
                  </div>

                  <div className={styles.field}>
                    <label
                      className={shared.label}
                      htmlFor="passwordConfirmation"
                    >
                      Confirmar senha
                    </label>
                    <div className={styles.passwordWrapper}>
                      <input
                        className={`${shared.input} ${styles.passwordInput} ${touched.passwordConfirmation && fieldErrors.passwordConfirmation ? styles.invalidInput : ""}`}
                        id="passwordConfirmation"
                        name="passwordConfirmation"
                        type={showPasswordConfirmation ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Digite a senha novamente"
                        value={form.passwordConfirmation}
                        onChange={handleChange}
                        onBlur={() => handleBlur("passwordConfirmation")}
                        aria-invalid={Boolean(
                          touched.passwordConfirmation &&
                          fieldErrors.passwordConfirmation,
                        )}
                        aria-describedby={
                          touched.passwordConfirmation &&
                          fieldErrors.passwordConfirmation
                            ? "passwordConfirmation-error"
                            : undefined
                        }
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
                    {renderFieldError("passwordConfirmation")}
                  </div>

                  {feedback && (
                    <div className={styles.feedback} role="alert">
                      <StatusMessage type={feedback.type}>
                        {feedback.message}
                      </StatusMessage>
                      {feedback.action && (
                        <p className={styles.errorAction}>{feedback.action}</p>
                      )}
                    </div>
                  )}

                  <div className={styles.submit}>
                    <Button
                      type="submit"
                      icon="fa-user-plus"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Criando conta..." : "Criar conta"}
                    </Button>
                  </div>
                </form>

                <p className={styles.loginPrompt}>
                  Já possui uma conta? <Link href="/login">Entrar</Link>
                </p>
              </>
            )}
          </section>
        </main>
      </Layout>
    </>
  );
}

function RegistrationSuccess({ email }) {
  return (
    <div className={styles.success}>
      <div
        className={`${shared.icon} ${styles.successIcon}`}
        aria-hidden="true"
      >
        <i className="fas fa-envelope"></i>
      </div>

      <span className={shared.badge}>CADASTRO RECEBIDO</span>
      <h1>Quase lá!</h1>
      <p>
        Sua conta foi criada. Enviamos um e-mail para <strong>{email}</strong>{" "}
        com as instruções para ativá-la.
      </p>
      <p className={styles.successHint}>
        O link de ativação é válido por 15 minutos. Confira também sua caixa de
        spam ou lixo eletrônico.
      </p>
      <Link href="/" className={styles.backLink}>
        Voltar para o início
      </Link>
    </div>
  );
}

export default RegistrationPage;
