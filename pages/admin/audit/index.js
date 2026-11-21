import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";

import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import { hasAdminSectionAccess } from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

export default function AdminAuditPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const hasAuditAccess = !isLoading && Boolean(user?.features?.includes("read:audit"));

  useEffect(() => {
    if (!isLoading && !user && (!error || [401, 403].includes(error.statusCode))) {
      router.replace("/login");
    }
    if (!isLoading && user && !hasAdminSectionAccess(user, "audit")) {
      router.replace("/admin");
    }
  }, [error, isLoading, router, user]);

  return (
    <>
      <AppHead title="Auditoria" description="Consulte os registros de auditoria do sistema." />
      <Layout>
        <main className={`${shared.container} ${shared.containerUltraWide}`}>
          <section className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}>
            <AdminBackButton />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true"><i className="fas fa-clipboard-list"></i></div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>Auditoria</h1>
              <p>Selecione o tipo de auditoria que deseja consultar.</p>
            </header>
            {isLoading ? (
              <p aria-live="polite">Carregando permissões...</p>
            ) : error ? (
              <StatusMessage type="critical">Não foi possível verificar suas permissões.</StatusMessage>
            ) : hasAuditAccess ? (
              <nav className={styles.menu} aria-label="Tipos de auditoria">
                <Link href="/admin/audit/banned" className={styles.menuItem}>
                  <span className={styles.menuIcon} aria-hidden="true"><i className="fas fa-user-slash"></i></span>
                  <span><strong>Contas banidas</strong><small>Consulte os registros de banimento e desbanimento de usuários.</small></span>
                  <i className="fas fa-chevron-right" aria-hidden="true"></i>
                </Link>
              </nav>
            ) : null}
          </section>
        </main>
      </Layout>
    </>
  );
}
