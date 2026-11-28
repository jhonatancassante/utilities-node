import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AdminBackButton from "@/components/AdminBackButton";
import AccessFallback from "@/components/AccessFallback";
import AppHead from "@/components/AppHead";
import DataTable from "@/components/DataTable";
import useSortableData from "@/hooks/use-sortable-data.js";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useAccessGate, { featureCheck } from "@/hooks/use-access-gate.js";
import { feedbackFromError } from "@/lib/client/feedback.js";
import { formatDateTime } from "@/lib/client/format.js";
import requestAPI from "@/lib/client/api.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function formatAccountAge(startValue, endValue) {
  if (!startValue || !endValue) {
    return "—";
  }

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

  let totalMonths = 0;

  while (addMonths(start, totalMonths + 1) <= end) {
    totalMonths += 1;
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  let cursor = addMonths(start, totalMonths);
  let days = 0;

  while (true) {
    const nextDay = new Date(cursor);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    if (nextDay > end) {
      break;
    }

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
    .map(
      ([value, singular, plural]) =>
        `${value} ${value === 1 ? singular : plural}`,
    )
    .join(", ");
}

export default function AdminBannedAuditPage() {
  const access = useAccessGate({
    checks: [featureCheck("read:audit")],
  });
  const { user, isLoading } = access;
  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    if (isLoading || !user?.features?.includes("read:audit")) {
      return undefined;
    }

    let active = true;

    async function loadEvents() {
      setIsLoadingEvents(true);

      try {
        const result = await requestAPI("/api/v1/admin/audit/banned");

        if (active) {
          setEvents(result);
        }
      } catch (requestError) {
        if (active) {
          setFeedback({
            ...feedbackFromError(requestError),
          });
        }
      } finally {
        if (active) {
          setIsLoadingEvents(false);
        }
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

      if (!term) {
        return true;
      }

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
  const sortableEvents = useMemo(
    () =>
      filteredEvents.map((event) => ({
        ...event,
        account_age_sort:
          Number.isFinite(new Date(event.created_at).getTime()) &&
          Number.isFinite(new Date(event.account_created_at).getTime())
            ? new Date(event.created_at).getTime() -
              new Date(event.account_created_at).getTime()
            : null,
      })),
    [filteredEvents],
  );
  const sort = useSortableData(sortableEvents);

  const banCount = events.filter((event) => event.action === "ban").length;
  const unbanCount = events.filter((event) => event.action === "unban").length;
  const currentlyBannedCount = new Set(
    events
      .filter((event) => event.is_currently_banned)
      .map((event) => event.user_id),
  ).size;

  if (access.state !== "allowed") {
    return (
      <AccessFallback title="Auditoria de contas banidas" access={access} />
    );
  }

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
            <AdminBackButton
              href="/admin/audit"
              label="Voltar para auditoria"
            />

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

            <DataTable
              records={sort.sortedRecords}
              loading={isLoadingEvents}
              loadingMessage="Carregando registros..."
              emptyMessage={
                events.length
                  ? "Nenhum registro corresponde aos filtros."
                  : "Ainda não há registros de banimento ou desbanimento."
              }
              columns={[
                {
                  key: "username",
                  label: "Conta",
                  render: (event) => (
                    <>
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
                    </>
                  ),
                },
                {
                  key: "account_created_at",
                  label: "Criação da conta",
                  render: (event) => formatDateTime(event.account_created_at),
                },
                {
                  key: "action",
                  label: "Ação",
                  render: (event) => (
                    <span
                      className={
                        event.action === "ban"
                          ? styles.banBadge
                          : styles.unbanBadge
                      }
                    >
                      {event.action === "ban" ? "Banimento" : "Desbanimento"}
                    </span>
                  ),
                },
                {
                  key: "created_at",
                  label: "Data da ação",
                  render: (event) => formatDateTime(event.created_at),
                },
                {
                  key: "account_age_sort",
                  label: "Idade da conta na ação",
                  render: (event) =>
                    formatAccountAge(
                      event.account_created_at,
                      event.created_at,
                    ),
                },
                {
                  key: "actor_username",
                  label: "Responsável",
                  render: (event) =>
                    event.actor_username ? (
                      <>
                        <strong>{event.actor_username}</strong>
                        <small>{event.actor_email}</small>
                      </>
                    ) : (
                      "Não identificado (registro anterior)"
                    ),
                },
                {
                  key: "is_currently_banned",
                  label: "Status atual",
                  render: (event) => (
                    <span
                      className={
                        event.is_currently_banned
                          ? styles.banBadge
                          : styles.activeBadge
                      }
                    >
                      {event.is_currently_banned ? "Banida" : "Não banida"}
                    </span>
                  ),
                },
              ]}
              sort={sort}
              caption="Auditoria de contas banidas"
            />

            <p className={styles.footnote}>
              A idade da conta é calculada até a data de cada ação. Os registros
              anteriores à implantação não possuem identificação do responsável.
            </p>
          </section>
        </main>
      </Layout>
    </>
  );
}
