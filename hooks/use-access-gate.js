import { useEffect } from "react";
import { useRouter } from "next/router";
import useUser from "@/hooks/use-user.js";
import {
  hasAdminAccess,
  hasAdminSectionAccess,
} from "@/models/authorization.js";

export function adminFallbackPath(user) {
  return hasAdminAccess(user) ? "/admin" : "/perfil";
}

export function adminSectionCheck(section) {
  return {
    allowed: (user) => hasAdminSectionAccess(user, section),
    redirectTo: adminFallbackPath,
  };
}

export function featureCheck(feature, redirectTo = adminFallbackPath) {
  return {
    allowed: (user) => Boolean(user.features?.includes(feature)),
    redirectTo,
  };
}

/**
 * Guarda de acesso das telas autenticadas.
 *
 * - sem sessão (ou 401/403): redireciona para /login;
 * - com sessão, mas sem permissão numa das `checks`: redireciona para o
 *   `redirectTo` da primeira verificação que falhou;
 * - devolve `state`: "loading" | "error" | "denied" | "allowed".
 *
 * Cada check é `{ allowed(user) => boolean, redirectTo: string | (user) => string }`.
 */
function useAccessGate({ checks = [] } = {}) {
  const router = useRouter();
  const userState = useUser();
  const { user, error, isLoading } = userState;

  const failedCheck = user
    ? checks.find((check) => !check.allowed(user))
    : null;
  const deniedPath = failedCheck
    ? typeof failedCheck.redirectTo === "function"
      ? failedCheck.redirectTo(user)
      : failedCheck.redirectTo
    : null;
  const mustLogin =
    !isLoading && !user && (!error || [401, 403].includes(error.statusCode));

  useEffect(() => {
    if (mustLogin) {
      router.replace("/login");
    } else if (!isLoading && deniedPath) {
      router.replace(deniedPath);
    }
  }, [deniedPath, isLoading, mustLogin, router]);

  let state = "allowed";
  if (isLoading || (!user && !error)) {
    state = "loading";
  } else if (error) {
    state = "error";
  } else if (!user || deniedPath) {
    state = "denied";
  }

  return { ...userState, state };
}

export default useAccessGate;
