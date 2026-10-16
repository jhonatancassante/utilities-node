import bcryptjs from "bcryptjs";
import { ConfigurationError } from "@/infra/errors";

function getNumberOfRounds() {
  return process.env.NODE_ENV === "production" ? 14 : 1;
}

function injectPepper(password) {
  const pepper = process.env.PASSWORD_PEPPER;

  if (!pepper) {
    throw new ConfigurationError({
      message: "PASSWORD_PEPPER não configurado.",
      action: "Verifique as variáveis de ambiente.",
    });
  }

  return `${password}${pepper}`;
}

async function hash(password) {
  const rounds = getNumberOfRounds();

  const pepperedPassword = injectPepper(password);

  return await bcryptjs.hash(pepperedPassword, rounds);
}

async function compare(providedPassword, storedPassword) {
  const pepperedPassword = injectPepper(providedPassword);

  return await bcryptjs.compare(pepperedPassword, storedPassword);
}

const password = {
  hash,
  compare,
};

export default password;
