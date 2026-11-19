import { jest } from "@jest/globals";

import controller from "@/infra/controller.js";
import {
  ConfigurationError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/infra/errors.js";
import session from "@/models/session.js";
import user from "@/models/user.js";

function createResponse() {
  return { setHeader: jest.fn() };
}

const loggedUser = { id: "user-1", features: ["read:session"] };

afterEach(() => {
  jest.restoreAllMocks();
});

describe("infra/controller.js", () => {
  describe(".createController()", () => {
    test("Middleware que não é função lança ConfigurationError", () => {
      expect(() =>
        controller.createController({ GET: () => {} }, { middlewares: ["x"] }),
      ).toThrow(ConfigurationError);
    });
  });

  describe(".setSessionCookie()", () => {
    test("Define cookie HttpOnly e sem cache", () => {
      const response = createResponse();

      controller.setSessionCookie(response, "abc");

      const [[, setCookie], [, cacheControl]] = response.setHeader.mock.calls;
      expect(setCookie).toContain("session_id=abc");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
      expect(setCookie).toContain("Path=/");
      expect(setCookie).toContain(
        `Max-Age=${session.EXPIRATION_IN_MILLISECONDS / 1000}`,
      );
      expect(cacheControl).toContain("no-store");
    });
  });

  describe(".clearSessionCookie()", () => {
    test("Invalida o cookie", () => {
      const response = createResponse();

      controller.clearSessionCookie(response);

      const [, setCookie] = response.setHeader.mock.calls[0];
      expect(setCookie).toContain("session_id=invalid");
      expect(setCookie).toContain("Max-Age=-1");
      expect(setCookie).toContain("HttpOnly");
    });
  });

  describe(".injectAnonymousOrUser()", () => {
    test("Sem cookie, segue como usuário anônimo", async () => {
      const request = { cookies: {} };
      const next = jest.fn();

      await controller.injectAnonymousOrUser(request, createResponse(), next);

      expect(request.context.user.features).toEqual([
        "create:session",
        "create:user",
        "read:activation_token",
      ]);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("Com sessão válida, injeta o usuário", async () => {
      jest
        .spyOn(session, "findOneValidByToken")
        .mockResolvedValue({ user_id: "user-1" });
      jest.spyOn(user, "findOneById").mockResolvedValue(loggedUser);
      const request = { cookies: { session_id: "token" } };

      await controller.injectAnonymousOrUser(
        request,
        createResponse(),
        jest.fn(),
      );

      expect(request.context.user).toBe(loggedUser);
    });

    test("Com sessão inválida, lança UnauthorizedError", async () => {
      jest
        .spyOn(session, "findOneValidByToken")
        .mockRejectedValue(new UnauthorizedError({}));
      const next = jest.fn();

      await expect(
        controller.injectAnonymousOrUser(
          { cookies: { session_id: "token" } },
          createResponse(),
          next,
        ),
      ).rejects.toThrow(UnauthorizedError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe(".injectUserOrAnonymousOnInvalidSession()", () => {
    test("Sem cookie, segue como anônimo sem mexer no cookie", async () => {
      const request = { cookies: {} };
      const response = createResponse();
      const next = jest.fn();

      await controller.injectUserOrAnonymousOnInvalidSession(
        request,
        response,
        next,
      );

      expect(request.context.user.features).toContain("create:session");
      expect(response.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("Com sessão válida, injeta o usuário", async () => {
      jest
        .spyOn(session, "findOneValidByToken")
        .mockResolvedValue({ user_id: "user-1" });
      jest.spyOn(user, "findOneById").mockResolvedValue(loggedUser);
      const request = { cookies: { session_id: "token" } };
      const response = createResponse();

      await controller.injectUserOrAnonymousOnInvalidSession(
        request,
        response,
        jest.fn(),
      );

      expect(request.context.user).toBe(loggedUser);
      expect(response.setHeader).not.toHaveBeenCalled();
    });

    test.each([
      ["sessão expirada ou inexistente", new UnauthorizedError({})],
      ["usuário da sessão inexistente", new NotFoundError({})],
    ])("Com %s, segue como anônimo e limpa o cookie", async (_, error) => {
      jest.spyOn(session, "findOneValidByToken").mockRejectedValue(error);
      jest.spyOn(user, "findOneById").mockRejectedValue(error);
      const request = { cookies: { session_id: "token" } };
      const response = createResponse();
      const next = jest.fn();

      await controller.injectUserOrAnonymousOnInvalidSession(
        request,
        response,
        next,
      );

      expect(request.context.user.features).toContain("create:session");
      expect(response.setHeader.mock.calls[0][1]).toContain(
        "session_id=invalid",
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("Erros inesperados continuam sendo lançados", async () => {
      const unexpected = new Error("banco fora do ar");
      jest.spyOn(session, "findOneValidByToken").mockRejectedValue(unexpected);
      const next = jest.fn();

      await expect(
        controller.injectUserOrAnonymousOnInvalidSession(
          { cookies: { session_id: "token" } },
          createResponse(),
          next,
        ),
      ).rejects.toBe(unexpected);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe(".canRequest()", () => {
    test("Com a feature, chama next()", () => {
      const next = jest.fn();

      controller.canRequest("read:session")(
        { context: { user: loggedUser } },
        {},
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("Sem a feature, lança ForbiddenError", () => {
      const next = jest.fn();

      expect(() =>
        controller.canRequest("create:migration")(
          { context: { user: loggedUser } },
          {},
          next,
        ),
      ).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
