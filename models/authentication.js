import crypto from "node:crypto";
import user from "@/models/user.js";
import password from "@/models/password.js";
import {
  BannedUserError,
  NotFoundError,
  UnauthorizedError,
} from "@/infra/errors.js";

let dummyHashPromise = null;

// O hash falso só é gerado na primeira vez em que é necessário, e não no
// carregamento do módulo. Se a geração falhar, a próxima chamada tenta de novo.
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = password
      .hash(crypto.randomBytes(16).toString("hex"))
      .catch(() => {
        dummyHashPromise = null;
        return null;
      });
  }

  return dummyHashPromise;
}

async function getUser(providedEmail, providedPassword) {
  try {
    const storedUser = await findUserByEmail(providedEmail, providedPassword);

    await validatePassword(providedPassword, storedUser.password);

    if (storedUser.banned_at) {
      throw new BannedUserError({});
    }

    return storedUser;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new UnauthorizedError({
        message: "Não foi possível autenticar seu usuário no sistema.",
        action:
          "Verifique se digitou o e-mail e a senha corretamente e tente novamente.",
        cause: error,
      });
    }

    throw error;
  }

  async function findUserByEmail(providedEmail) {
    try {
      return await user.findOneByEmail(providedEmail);
    } catch (error) {
      if (error instanceof NotFoundError) {
        const dummyHash = await getDummyHash();
        if (dummyHash) {
          await password.compare(providedPassword, dummyHash);
        }
        throw new UnauthorizedError({
          message: "Email não confere.",
          action:
            "Verifique se digitou o email corretamente e tente novamente.",
          cause: error,
        });
      }
      throw error;
    }
  }

  async function validatePassword(providedPassword, storedPassword) {
    const correctPasswordMatch = await password.compare(
      providedPassword,
      storedPassword,
    );

    if (!correctPasswordMatch) {
      throw new UnauthorizedError({
        message: "Senha não confere.",
        action: "Verifique se digitou a senha corretamente e tente novamente.",
      });
    }
  }
}

const authentication = {
  getUser,
};

export default authentication;
