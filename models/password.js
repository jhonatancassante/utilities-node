import bcryptjs from "bcryptjs";
import { createHmac } from "node:crypto";
import { ConfigurationError } from "@/infra/errors";

function getNumberOfRounds() {
  return process.env.NODE_ENV === "production" ? 14 : 4;
}

function injectPepper(password) {
  const pepper = process.env.PASSWORD_PEPPER;

  if (!pepper) {
    throw new ConfigurationError({
      message: "A variável de ambiente PASSWORD_PEPPER não está configurada.",
      action: "Verifique as variáveis de ambiente.",
    });
  }

  return createHmac("sha256", pepper).update(password).digest("base64");
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
