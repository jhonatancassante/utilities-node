// pages/cadastro/ativar/[token_id].js
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import activateAccount from "@/lib/activation.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function AccountActivationPage() {
  const router = useRouter();
  const activationRequest = useRef(null);
  const [result, setResult] = useState({ status: "loading" });

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const tokenId = router.query.token_id;

    if (typeof tokenId !== "string" || !tokenId) {
      setResult({
        status: "error",
        message: "O link de ativação não contém um token válido.",
        action: "Confira se você utilizou o link completo enviado por e-mail.",
      });
      return;
    }

    if (activationRequest.current?.tokenId !== tokenId) {
      activationRequest.current = {
        tokenId,
        promise: activateAccount(tokenId),
      };
    }

    let isActive = true;

    activationRequest.current.promise
      .then(() => {
        if (isActive) {
          setResult({ status: "success" });
        }
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        if (
          error.statusCode === 403 &&
          error.message === "Você não pode mais utilizar tokens de ativação."
        ) {
          setResult({ status: "already-active" });
          return;
        }

        setResult({
          status: "error",
          message:
            error.statusCode === 404
              ? "Este link de ativação é inválido, já foi utilizado ou expirou."
              : error.message,
          action:
            error.statusCode === 404
              ? "Se você já ativou sua conta, não precisa fazer nada. Caso contrário, será necessário realizar um novo cadastro."
              : error.action,
        });
      });

    return () => {
      isActive = false;
    };
  }, [router.isReady, router.query.token_id]);

  const isSuccessful =
    result.status === "success" || result.status === "already-active";

  return (
    <>
      <AppHead
        title="Ativação de conta"
        description="Ative sua conta do Utilities."
      />

      <Layout>
        <main className={shared.container}>
          <section className={`${shared.card} ${styles.card}`}>
            <div
              className={`${shared.icon} ${isSuccessful ? styles.successIcon : result.status === "error" ? styles.errorIcon : styles.loadingIcon}`}
              aria-hidden="true"
            >
              {result.status === "loading" && (
                <i className="fas fa-circle-notch fa-spin"></i>
              )}
              {result.status === "success" && (
                <i className="fas fa-check-circle"></i>
              )}
              {result.status === "already-active" && (
                <i className="fas fa-check-circle"></i>
              )}
              {result.status === "error" && (
                <i className="fas fa-exclamation-circle"></i>
              )}
            </div>

            <span className={shared.badge}>
              {result.status === "loading" && "ATIVAÇÃO DE CONTA"}
              {result.status === "success" && "ATIVAÇÃO CONCLUÍDA"}
              {result.status === "already-active" && "CONTA JÁ ATIVADA"}
              {result.status === "error" && "NÃO FOI POSSÍVEL ATIVAR"}
            </span>

            <h1>
              {result.status === "loading" && "Ativando sua conta..."}
              {result.status === "success" && "Tudo pronto!"}
              {result.status === "already-active" && "Sua conta já está ativa"}
              {result.status === "error" && "Ops! Algo deu errado."}
            </h1>

            <div className={styles.message} aria-live="polite">
              {result.status === "loading" && (
                <p>
                  Estamos confirmando seu endereço de e-mail e ativando sua
                  conta. Isso deve levar apenas alguns instantes.
                </p>
              )}

              {result.status === "success" && (
                <>
                  <p>
                    Seu endereço de e-mail foi confirmado e sua conta no
                    Utilities foi ativada com sucesso.
                  </p>
                  <p className={styles.hint}>
                    A ativação foi concluída. A tela de acesso à conta será
                    disponibilizada em uma próxima etapa.
                  </p>
                </>
              )}

              {result.status === "already-active" && (
                <>
                  <p>
                    Esta conta já foi ativada anteriormente. Você não precisa
                    utilizar este link novamente.
                  </p>
                  <p className={styles.hint}>
                    A tela de acesso à conta será disponibilizada em uma
                    próxima etapa.
                  </p>
                </>
              )}

              {result.status === "error" && (
                <>
                  <p className={styles.errorMessage}>{result.message}</p>
                  {result.action && (
                    <p className={styles.hint}>{result.action}</p>
                  )}
                </>
              )}
            </div>

            {result.status !== "loading" && (
              <Link href="/" className={styles.backLink}>
                <i className="fas fa-home" aria-hidden="true"></i>
                Voltar para o início
              </Link>
            )}
          </section>
        </main>
      </Layout>
    </>
  );
}

export default AccountActivationPage;
