import { InternalServerError } from "@/infra/errors.js";
import authorization from "@/models/authorization.js";

describe("models/authorization.js", () => {
  describe(".can()", () => {
    test("Sem usuário", () => {
      expect(() => authorization.can()).toThrow(InternalServerError);
    });

    test("Usuário sem `features`", () => {
      const createdUser = {
        username: "UserWithoutFeatures",
      };
      expect(() => authorization.can(createdUser)).toThrow(InternalServerError);
    });

    test("Com uma feature criada dinamicamente e atribuída ao usuário", () => {
      const createdUser = {
        features: ["read:dynamicreports"],
      };

      expect(authorization.can(createdUser, "read:dynamicreports")).toBe(true);
    });

    test("Com uma feature dinâmica que não foi atribuída ao usuário", () => {
      expect(authorization.can({ features: [] }, "read:dynamicreports")).toBe(
        false,
      );
    });

    test("Sem informar uma feature válida", () => {
      const createdUser = { features: [] };

      expect(() => authorization.can(createdUser)).toThrow(InternalServerError);
    });

    test("Com um usuário válido e uma `feature` conhecida", () => {
      const createdUser = {
        features: ["create:user"],
      };
      expect(authorization.can(createdUser, "create:user")).toBe(true);
    });
  });

  describe(".filterOutput()", () => {
    test("Sem usuário", () => {
      expect(() => authorization.filterOutput()).toThrow(InternalServerError);
    });

    test("Usuário sem `features`", () => {
      const createdUser = {
        username: "UserWithoutFeatures",
      };
      expect(() => authorization.filterOutput(createdUser)).toThrow(
        InternalServerError,
      );
    });

    test("Sem informar uma feature válida", () => {
      const createdUser = { features: [] };

      expect(() => authorization.filterOutput(createdUser)).toThrow(
        InternalServerError,
      );
    });

    test("Com usuário e `feature`, mas sem `resource`", () => {
      const createdUser = {
        features: [],
      };
      expect(() => {
        authorization.filterOutput(createdUser, "read:user");
      }).toThrow(InternalServerError);
    });

    test("Com um usuário válido, uma `feature` conhecida e recurso", () => {
      const createdUser = {
        features: ["read:user"],
      };

      const resource = {
        id: 1,
        username: "resource",
        features: ["read:user"],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        email: "resource@example.com",
        password: "resourcepassword",
      };

      const result = authorization.filterOutput(
        createdUser,
        "read:user",
        resource,
      );

      expect(result).toEqual({
        id: 1,
        username: "resource",
        features: ["read:user"],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      });
    });
    test("read:user:self inclui privilégios cadastrados no banco", () => {
      const currentUser = {
        id: "user-1",
        features: ["read:user:self"],
      };
      const userResource = {
        id: "user-1",
        username: "usuario",
        email: "usuario@example.com",
        features: ["read:dynamicreports"],
        privileged_features: ["read:dynamicreports"],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const result = authorization.filterOutput(
        currentUser,
        "read:user:self",
        userResource,
      );

      expect(result.privileged_features).toEqual(["read:dynamicreports"]);
    });

    test("`read:audit` retorna somente os campos previstos para auditoria", () => {
      const auditor = { features: ["read:audit"] };
      const event = {
        id: "event-1",
        user_id: "user-1",
        actor_user_id: "admin-1",
        action: "ban",
        username: "usuario",
        email: "usuario@example.com",
        account_created_at: "2026-01-01T00:00:00Z",
        actor_username: "admin",
        actor_email: "admin@example.com",
        created_at: "2026-02-01T00:00:00Z",
        is_currently_banned: true,
        current_banned_at: "2026-02-01T00:00:00Z",
        password: "segredo",
      };

      const result = authorization.filterOutput(auditor, "read:audit", [event]);

      expect(result).toEqual([
        {
          id: "event-1",
          user_id: "user-1",
          actor_user_id: "admin-1",
          action: "ban",
          username: "usuario",
          email: "usuario@example.com",
          account_created_at: "2026-01-01T00:00:00Z",
          actor_username: "admin",
          actor_email: "admin@example.com",
          created_at: "2026-02-01T00:00:00Z",
          is_currently_banned: true,
          current_banned_at: "2026-02-01T00:00:00Z",
        },
      ]);
      expect(result[0]).not.toHaveProperty("password");
    });

    test("`read:session` não devolve o token da sessão", () => {
      const sessionOwner = { id: "user-1", features: ["read:session"] };
      const sessionResource = {
        id: "session-1",
        token: "token-secreto",
        user_id: "user-1",
        expires_at: "2026-02-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const result = authorization.filterOutput(
        sessionOwner,
        "read:session",
        sessionResource,
      );

      expect(result).toEqual({
        id: "session-1",
        user_id: "user-1",
        expires_at: "2026-02-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      });
      expect(result).not.toHaveProperty("token");
    });
  });
  describe(".hasAdminAccess()", () => {
    test("Usuário sem features privilegiadas", () => {
      expect(
        authorization.hasAdminAccess({
          features: ["read:user"],
          privileged_features: [],
        }),
      ).toBe(false);
    });

    test("Usuário com qualquer feature privilegiada", () => {
      expect(
        authorization.hasAdminAccess({
          features: ["read:status:all"],
          privileged_features: ["read:status:all"],
        }),
      ).toBe(true);
      expect(
        authorization.hasAdminAccess({
          features: ["update:user:others"],
          privileged_features: ["update:user:others"],
        }),
      ).toBe(true);
    });

    test("Usuário ausente ou sem features", () => {
      expect(authorization.hasAdminAccess()).toBe(false);
      expect(authorization.hasAdminAccess({})).toBe(false);
      expect(
        authorization.hasAdminAccess({
          features: ["read:dynamicreports"],
          privileged_features: ["read:dynamicreports"],
        }),
      ).toBe(true);
    });
  });

  describe(".hasAdminSectionAccess()", () => {
    test("Usuário sem a feature exigida para a seção", () => {
      expect(
        authorization.hasAdminSectionAccess(
          { features: ["read:status:all"] },
          "users",
        ),
      ).toBe(false);
    });

    test("Usuário com a feature exigida para a seção", () => {
      expect(
        authorization.hasAdminSectionAccess(
          { features: ["update:user:others"] },
          "users",
        ),
      ).toBe(true);
    });

    test("Usuário com a feature de auditoria acessa a seção", () => {
      expect(
        authorization.hasAdminSectionAccess({ features: ["read:audit"] }, "audit"),
      ).toBe(true);
    });

    test("Seção inexistente", () => {
      expect(
        authorization.hasAdminSectionAccess({ features: [] }, "unknown"),
      ).toBe(false);
    });
  });

  describe(".getAvailableAdminSections()", () => {
    test("Disponibiliza somente as seções autorizadas", () => {
      expect(
        authorization
          .getAvailableAdminSections({ features: ["update:user:others"] })
          .map((section) => section.id),
      ).toEqual(["users"]);

      expect(
        authorization
          .getAvailableAdminSections({ features: ["read:status:all"] })
          .map((section) => section.id),
      ).toEqual(["status"]);
    });

    test("Disponibiliza todas as seções quando o usuário possui as permissões", () => {
      expect(
        authorization
          .getAvailableAdminSections({
            features: ["update:user:others", "read:status:all"],
          })
          .map((section) => section.id),
      ).toEqual(["users", "status"]);
    });

    test("Não disponibiliza seções para usuário sem permissões", () => {
      expect(authorization.getAvailableAdminSections({ features: [] })).toEqual(
        [],
      );
    });
  });
});
