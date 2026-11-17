// pages/cadastro/index.js
import { useState } from "react";
import Link from "next/link";

import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import requestAPI from "@/lib/api.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const INITIAL_FORM = {
  username: "",
  email: "",
  password: "",
  passwordConfirmation: "",
};

function RegistrationPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
    setFeedback(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.password !== form.passwordConfirmation) {
      setFeedback({
        type: "error",
        message: "As senhas informadas não coincidem.",
      });
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

                <form className={styles.form} onSubmit={handleSubmit}>
                  <div className={styles.field}>
                    <label className={shared.label} htmlFor="username">
                      Nome de usuário
                    </label>
                    <input
                      className={shared.input}
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="Como deseja ser identificado?"
                      value={form.username}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={shared.label} htmlFor="email">
                      E-mail
                    </label>
                    <input
                      className={shared.input}
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={shared.label} htmlFor="password">
                      Senha
                    </label>
                    <input
                      className={shared.input}
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Digite sua senha"
                      value={form.password}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className={styles.field}>
                    <label
                      className={shared.label}
                      htmlFor="passwordConfirmation"
                    >
                      Confirmar senha
                    </label>
                    <input
                      className={shared.input}
                      id="passwordConfirmation"
                      name="passwordConfirmation"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Digite a senha novamente"
                      value={form.passwordConfirmation}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
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
                  Já possui uma conta?{" "}
                  <span>O acesso será disponibilizado em breve.</span>
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
