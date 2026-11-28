import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import shared from "@/styles/shared.module.css";

/**
 * O que mostrar enquanto a guarda de acesso (useAccessGate) não libera a tela.
 * Acesso negado não renderiza nada: o redirecionamento já está em andamento.
 */
function AccessFallback({
  title,
  access,
  isBusy = false,
  loadingMessage = "Carregando permissões...",
}) {
  if (!isBusy && access.state !== "loading" && access.state !== "error") {
    return null;
  }

  return (
    <>
      <AppHead title={title} />
      <Layout>
        <main className={shared.container}>
          <section className={shared.card}>
            {isBusy || access.state === "loading" ? (
              <p>{loadingMessage}</p>
            ) : (
              <StatusMessage
                type="critical"
                name={access.error.name}
                action={access.error.action}
              >
                {access.error.message}
              </StatusMessage>
            )}
          </section>
        </main>
      </Layout>
    </>
  );
}

export default AccessFallback;
