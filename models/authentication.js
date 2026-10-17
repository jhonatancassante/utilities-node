import user from "@/models/user.js";
import password from "@/models/password.js";
import { NotFoundError, UnauthorizedError } from "@/infra/errors.js";

async function getAuthenticatedUser(providedEmail, providedPassword) {
  try {
    const storedUser = await findUserByEmail(providedEmail);

    await validatePassword(providedPassword, storedUser.password);

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
  getAuthenticatedUser,
};

export default authentication;
