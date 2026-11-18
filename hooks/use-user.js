import useSWR, { useSWRConfig } from "swr";

import session from "@/lib/client/session.js";

export const USER_KEY = "/api/v1/user";

const SWR_OPTIONS = Object.freeze({
  revalidateOnFocus: false,
  shouldRetryOnError: false,
});

/**
 * Fonte única do usuário autenticado no navegador.
 * Todas as telas compartilham a mesma chave do SWR e as mesmas opções.
 */
function useUser() {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR(
    USER_KEY,
    session.getCurrentUser,
    SWR_OPTIONS,
  );

  return {
    user: data ?? null,
    error,
    isLoading,
    refreshUser: () => mutate(USER_KEY),
    setUser: (updatedUser) =>
      mutate(USER_KEY, updatedUser, { revalidate: false }),
    clearUser: () => mutate(USER_KEY, null, { revalidate: false }),
  };
}

export default useUser;
