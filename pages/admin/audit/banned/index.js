import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import { hasAdminAccess } from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatAccountAge(startValue, endValue) {
  if (!startValue || !endValue) return "—";

  const start = new Date(startValue);
  const end = new Date(endValue);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return "—";
  }

  function addMonths(date, amount) {
    const result = new Date(date);
    const day = result.getUTCDate();

    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + amount);

    const lastDay = new Date(
      Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
    ).getUTCDate();

    result.setUTCDate(Math.min(day, lastDay));

    return result;
  }

  let cursor = new Date(start);
  let years = 0;
  let months = 0;
  let days = 0;

  while (addMonths(cursor, 12) <= end) {
    cursor = addMonths(cursor, 12);
    years += 1;
  }

  while (addMonths(cursor, 1) <= end) {
    cursor = addMonths(cursor, 1);
    months += 1;
  }

  while (true) {
    const nextDay = new Date(cursor);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    if (nextDay > end) break;

    cursor = nextDay;
    days += 1;
  }

  const remainingMinutes = Math.floor((end - cursor) / 60000);
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  const units = [
    [years, "ano", "anos"],
    [months, "mês", "meses"],
    [days, "dia", "dias"],
    [hours, "hora", "horas"],
    [minutes, "minuto", "minutos"],
  ];
  const firstNonZero = units.findIndex(([value]) => value > 0);

  return units
    .slice(firstNonZero === -1 ? units.length - 1 : firstNonZero)
    .map(([value, singular, plural]) => `${value} ${value === 1 ? singular : plural}`)
    .join(", ");
}

export default function AdminBannedAuditPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }

    if (!isLoading && user && !user.features?.includes("read:audit")) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
  }, [error, isLoading, router, user]);

  useEffect(() => {
    if (isLoading || !user?.features?.includes("read:audit")) {
      return undefined;
    }

    let active = true;

    async function loadEvents() {
      setIsLoadingEvents(true);

      try {
        const result = await requestAPI("/api/v1/admin/audit/banned");

        if (active) setEvents(result);
      } catch (requestError) {
        if (active) {
          setFeedback({
            name: requestError.statusCode ? requestError.name : undefined,
            message: requestError.message,
            action: requestError.action,
          });
        }
      } finally {
        if (active) setIsLoadingEvents(false);
      }
    }

    loadEvents();

    return () => {
      active = false;
    };
  }, [isLoading, user]);

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("pt-BR");

    return events.filter((event) => {
      if (actionFilter !== "all" && event.action !== actionFilter) {
        return false;
      }

      if (!term) return true;

      return [
        event.username,
        event.email,
        event.actor_username,
        event.actor_email,
      ]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(term));
    });
  }, [actionFilter, events, searchTerm]);

  const banCount = events.filter((event) => event.action === "ban").length;
  const unbanCount = events.filter((event) => event.action === "unban").length;
  const currentlyBannedCount = new Set(
    events
      .filter((event) => event.is_currently_banned)
      .map((event) => event.user_id),
  ).size;

  if (isLoading || (!user && !error)) {
    return (
      <>
        <AppHead title="Auditoria de contas banidas" />
        <Layout>
          <main className={`${shared.container} ${shared.containerUltraWide}`}>
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
        <AppHead title="Auditoria de contas banidas" />
        <Layout>
          <main className={`${shared.container} ${shared.containerUltraWide}`}>
            <section className={`${shared.card} ${styles.card}`}>
              <StatusMessage type="critical">
                Não foi possível verificar suas permissões.
              </StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (!user?.features?.includes("read:audit")) return null;

  return (
    <>
      <AppHead
        title="Auditoria de contas banidas"
        description="Histórico de banimentos e desbanimentos de contas."
      />
      <Layout>
        <main className={`${shared.container} ${shared.containerUltraWide}`}>
          <section
            className={`${shared.card} ${shared.cardUltraWide} ${styles.card}`}
          >
            <AdminBackButton />

            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-user-slash"></i>
              </div>
              <span className={shared.badge}>AUDITORIA</span>
              <h1>Contas banidas</h1>
              <p>
                Histórico de banimentos e desbanimentos, com identificação da
                conta e responsável por cada ação.
              </p>
            </header>

            <section
              className={styles.summary}
              aria-label="Resumo da auditoria"
            >
              <div>
                <strong>{banCount}</strong>
                <span>Banimentos registrados</span>
              </div>
              <div>
                <strong>{unbanCount}</strong>
                <span>Desbanimentos registrados</span>
              </div>
              <div>
                <strong>{currentlyBannedCount}</strong>
                <span>Contas atualmente banidas</span>
              </div>
            </section>

            <div className={styles.filters}>
              <label>
                <span>Pesquisar</span>
                <input
                  className={shared.input}
                  type="search"
                  placeholder="Username, e-mail ou responsável"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <label>
                <span>Tipo de ação</span>
                <select
                  className={shared.input}
                  value={actionFilter}
                  onChange={(event) => setActionFilter(event.target.value)}
                >
                  <option value="all">Todas as ações</option>
                  <option value="ban">Banimentos</option>
                  <option value="unban">Desbanimentos</option>
                </select>
              </label>
            </div>

            {feedback && (
              <StatusMessage
                type="error"
                name={feedback.name}
                action={feedback.action}
              >
                {feedback.message}
              </StatusMessage>
            )}

            {isLoadingEvents ? (
              <p className={styles.empty}>Carregando registros...</p>
            ) : filteredEvents.length === 0 ? (
              <p className={styles.empty}>
                {events.length
                  ? "Nenhum registro corresponde aos filtros."
                  : "Ainda não há registros de banimento ou desbanimento."}
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Conta</th>
                      <th>Criação da conta</th>
                      <th>Ação</th>
                      <th>Data da ação</th>
                      <th>Idade da conta na ação</th>
                      <th>Responsável</th>
                      <th>Status atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={event.id}>
                        <td>
                          {event.user_id ? (
                            <Link
                              href={`/admin/users?username=${encodeURIComponent(event.username)}`}
                              className={styles.userLink}
                            >
                              <strong>{event.username}</strong>
                            </Link>
                          ) : (
                            <strong>{event.username}</strong>
                          )}
                          <small>{event.email}</small>
                          <code>{event.user_id ?? "Conta removida"}</code>
                        </td>
                        <td>{formatDate(event.account_created_at)}</td>
                        <td>
                          <span
                            className={
                              event.action === "ban"
                                ? styles.banBadge
                                : styles.unbanBadge
                            }
                          >
                            {event.action === "ban"
                              ? "Banimento"
                              : "Desbanimento"}
                          </span>
                        </td>
                        <td>{formatDate(event.created_at)}</td>
                        <td>
                          {formatAccountAge(
                            event.account_created_at,
                            event.created_at,
                          )}
                        </td>
                        <td>
                          {event.actor_username ? (
                            <>
                              <strong>{event.actor_username}</strong>
                              <small>{event.actor_email}</small>
                            </>
                          ) : (
                            "Não identificado (registro anterior)"
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              event.is_currently_banned
                                ? styles.banBadge
                                : styles.activeBadge
                            }
                          >
                            {event.is_currently_banned
                              ? "Banida"
                              : "Não banida"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className={styles.footnote}>
              A idade da conta é calculada até a data de cada ação. Os registros
              anteriores à implantação não possuem identificação do
              responsável.
            </p>
          </section>
        </main>
      </Layout>
    </>
  );
}
