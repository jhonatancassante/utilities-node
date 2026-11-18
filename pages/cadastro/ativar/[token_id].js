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
          error.message ===
            "Você não pode mais utilizar tokens de ativação."
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

  const tokenId = router.query.token_id;
  const hasInvalidToken =
    router.isReady && (typeof tokenId !== "string" || !tokenId);

  const displayedResult = hasInvalidToken
    ? {
        status: "error",
        message: "O link de ativação não contém um token válido.",
        action: "Confira se você utilizou o link completo enviado por e-mail.",
      }
    : result;

  const isSuccessful =
    displayedResult.status === "success" ||
    displayedResult.status === "already-active";

  let iconClass = styles.loadingIcon;

  if (isSuccessful) {
    iconClass = styles.successIcon;
  }

  if (displayedResult.status === "error") {
    iconClass = styles.errorIcon;
  }

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
              className={`${shared.icon} ${iconClass}`}
              aria-hidden="true"
            >
              {displayedResult.status === "loading" && (
                <i className="fas fa-circle-notch fa-spin"></i>
              )}
              {isSuccessful && <i className="fas fa-check-circle"></i>}
              {displayedResult.status === "error" && (
                <i className="fas fa-exclamation-circle"></i>
              )}
            </div>

            <span className={shared.badge}>
              {displayedResult.status === "loading" && "ATIVAÇÃO DE CONTA"}
              {displayedResult.status === "success" && "ATIVAÇÃO CONCLUÍDA"}
              {displayedResult.status === "already-active" && "CONTA JÁ ATIVADA"}
              {displayedResult.status === "error" && "NÃO FOI POSSÍVEL ATIVAR"}
            </span>

            <h1>
              {displayedResult.status === "loading" && "Ativando sua conta..."}
              {displayedResult.status === "success" && "Tudo pronto!"}
              {displayedResult.status === "already-active" && "Sua conta já está ativa"}
              {displayedResult.status === "error" && "Ops! Algo deu errado."}
            </h1>

            <div className={styles.message} aria-live="polite">
              {displayedResult.status === "loading" && (
                <p>
                  Estamos confirmando seu endereço de e-mail e ativando sua
                  conta. Isso deve levar apenas alguns instantes.
                </p>
              )}

              {displayedResult.status === "success" && (
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

              {displayedResult.status === "already-active" && (
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

              {displayedResult.status === "error" && (
                <>
                  <p className={styles.errorMessage}>{displayedResult.message}</p>
                  {displayedResult.action && (
                    <p className={styles.hint}>{displayedResult.action}</p>
                  )}
                </>
              )}
            </div>

            {displayedResult.status !== "loading" && (
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
