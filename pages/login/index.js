import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import session from "@/lib/client/session.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function LoginPage() {
  const router = useRouter();
  const { user: currentUser, isLoading, refreshUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && currentUser) router.replace("/perfil");
  }, [currentUser, isLoading, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    if (!email.trim() || !password) {
      setFeedback({
        type: "error",
        message: "Informe seu e-mail e sua senha para continuar.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await session.login(email.trim(), password);
      await refreshUser();
      router.replace("/perfil");
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

  return (
    <>
      <AppHead title="Entrar" description="Acesse sua conta do Utilities." />
      <Layout>
        <main className={shared.container}>
          <section className={`${shared.card} ${styles.card}`}>
            <div className={shared.icon} aria-hidden="true">
              <i className="fas fa-sign-in-alt"></i>
            </div>
            <span className={shared.badge}>BEM-VINDO DE VOLTA</span>
            <h1>Entrar</h1>
            <p className={styles.description}>
              Informe os dados da sua conta para acessar o Utilities.
            </p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label className={shared.label} htmlFor="email">
                  E-mail
                </label>
                <input
                  className={shared.input}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={shared.label} htmlFor="password">
                  Senha
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    className={`${shared.input} ${styles.passwordInput}`}
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                    required
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
                  icon="fa-sign-in-alt"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Entrando..." : "Entrar"}
                </Button>
              </div>
            </form>

            <p className={styles.signupPrompt}>
              Ainda não possui uma conta?{" "}
              <Link href="/cadastro">Criar conta</Link>
            </p>
          </section>
        </main>
      </Layout>
    </>
  );
}

export default LoginPage;
