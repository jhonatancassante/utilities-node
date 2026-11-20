import * as errors from "@/infra/errors.js";

const defaultStatusCodes = {
  ConflictError: 409,
  ConfigurationError: 500,
  ForbiddenError: 403,
  InternalServerError: 500,
  MethodNotAllowedError: 405,
  NotFoundError: 404,
  ServiceError: 503,
  UnauthorizedError: 401,
  ValidationError: 400,
};

describe("infra/errors.js", () => {
  describe("Exportações", () => {
    test("Exporta todos os erros esperados", () => {
      expect(Object.keys(errors).sort()).toEqual(
        Object.keys(defaultStatusCodes).sort(),
      );
    });
  });

  describe.each(Object.entries(defaultStatusCodes))("%s", (name, status) => {
    const ErrorClass = errors[name];

    test("É um Error com nome e status_code corretos", () => {
      const error = new ErrorClass({});

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe(name);
      expect(error.statusCode).toBe(status);
    });

    test("toJSON() expõe name, message, action e status_code", () => {
      const json = new ErrorClass({}).toJSON();

      expect(json).toEqual({
        name,
        message: expect.any(String),
        action: expect.any(String),
        status_code: status,
      });
    });

    test("Não expõe a causa no JSON", () => {
      const json = new ErrorClass({
        cause: new Error("segredo interno"),
      }).toJSON();

      expect(JSON.stringify(json)).not.toContain("segredo interno");
    });
  });

  describe("ServiceError com `context`", () => {
    test("Inclui o contexto no JSON (o controller nunca o devolve ao cliente, pois o troca por InternalServerError)", () => {
      const json = new errors.ServiceError({ context: { to: "a@b.com" } });

      expect(json.toJSON().context).toEqual({ to: "a@b.com" });
    });
  });

  describe("Parâmetros do construtor", () => {
    test("Mensagens e ações customizadas substituem as padrão", () => {
      const error = new errors.ValidationError({
        message: "Mensagem própria.",
        action: "Ação própria.",
      });

      expect(error.message).toBe("Mensagem própria.");
      expect(error.action).toBe("Ação própria.");
    });

    test("Guarda a causa original", () => {
      const cause = new Error("original");

      expect(new errors.ServiceError({ cause }).cause).toBe(cause);
    });

    test("Mensagens padrão não têm os typos corrigidos", () => {
      expect(new errors.ServiceError({}).action).toContain("Verifique");
      expect(new errors.ServiceError({}).action).not.toContain("Verificque");
    });
  });
});
