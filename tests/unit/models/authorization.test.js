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
    test("Com update:user e o próprio recurso", () => {
      const currentUser = { id: "user-1", features: ["update:user"] };
      const resource = { id: "user-1" };

      expect(authorization.can(currentUser, "update:user", resource)).toBe(
        true,
      );
    });

    test("Com update:user e outro recurso sem a permissão administrativa", () => {
      const currentUser = { id: "user-1", features: ["update:user"] };
      const resource = { id: "user-2" };

      expect(authorization.can(currentUser, "update:user", resource)).toBe(
        false,
      );
    });

    test("Com update:user e outro recurso com a permissão administrativa", () => {
      const currentUser = {
        id: "user-1",
        features: ["update:user", "update:user:others"],
      };
      const resource = { id: "user-2" };

      expect(authorization.can(currentUser, "update:user", resource)).toBe(
        true,
      );
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

    test("read:user:others filtra uma lista de usuários e define privilégios vazios", () => {
      const administrator = { features: ["read:user:others"] };
      const resource = [
        {
          id: "user-2",
          username: "outro",
          email: "outro@example.com",
          features: ["read:session"],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
          banned_at: null,
          password: "segredo",
        },
      ];

      expect(
        authorization.filterOutput(administrator, "read:user:others", resource),
      ).toEqual([
        {
          id: "user-2",
          username: "outro",
          email: "outro@example.com",
          features: ["read:session"],
          privileged_features: [],
          banned_at: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
      ]);
    });

    test("read:user:self não expõe outro usuário", () => {
      const currentUser = { id: "user-1", features: ["read:user:self"] };
      const resource = { id: "user-2", username: "outro" };

      expect(
        authorization.filterOutput(currentUser, "read:user:self", resource),
      ).toBeUndefined();
    });

    test("read:session não expõe a sessão de outro usuário", () => {
      const currentUser = { id: "user-1", features: ["read:session"] };
      const resource = { id: "session-1", user_id: "user-2" };

      expect(
        authorization.filterOutput(currentUser, "read:session", resource),
      ).toBeUndefined();
    });

    test("read:activation_token retorna somente os campos permitidos", () => {
      const currentUser = { features: ["read:activation_token"] };
      const resource = {
        id: "token-1",
        user_id: "user-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:01:00Z",
        expires_at: "2026-01-01T00:15:00Z",
        used_at: null,
        token: "segredo",
      };

      expect(
        authorization.filterOutput(
          currentUser,
          "read:activation_token",
          resource,
        ),
      ).toEqual({
        id: "token-1",
        user_id: "user-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:01:00Z",
        expires_at: "2026-01-01T00:15:00Z",
        used_at: null,
      });
    });

    test("read:migration filtra os campos internos das migrações", () => {
      const currentUser = { features: ["read:migration"] };
      const resource = [
        {
          path: "infra/migrations/001.js",
          name: "001",
          timestamp: 1,
          applied: true,
        },
      ];

      expect(
        authorization.filterOutput(currentUser, "read:migration", resource),
      ).toEqual([
        { path: "infra/migrations/001.js", name: "001", timestamp: 1 },
      ]);
    });

    test("read:feature filtra os campos internos de uma feature", () => {
      const currentUser = { features: ["read:feature"] };
      const resource = {
        id: "feature-1",
        name: "read:reports",
        label: "Consultar relatórios",
        group_name: "Relatórios",
        description: "Permite consultar relatórios.",
        is_self_removable: true,
        is_privileged: false,
        is_protected: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        deleted_at: null,
      };

      expect(
        authorization.filterOutput(currentUser, "read:feature", resource),
      ).toEqual({
        id: "feature-1",
        name: "read:reports",
        label: "Consultar relatórios",
        group_name: "Relatórios",
        description: "Permite consultar relatórios.",
        is_self_removable: true,
        is_privileged: false,
        is_protected: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      });
    });

    test("read:status não expõe a versão do banco sem a permissão adicional", () => {
      const currentUser = { features: ["read:status"] };
      const resource = {
        updated_at: "2026-01-01T00:00:00Z",
        dependencies: {
          database: {
            max_connections: 100,
            opened_connections: 1,
            version: "16.0",
          },
        },
      };

      expect(
        authorization.filterOutput(currentUser, "read:status", resource),
      ).toEqual({
        updated_at: "2026-01-01T00:00:00Z",
        dependencies: {
          database: {
            max_connections: 100,
            opened_connections: 1,
          },
        },
      });
    });

    test("read:status expõe a versão do banco com a permissão adicional", () => {
      const currentUser = {
        features: ["read:status", "read:status:all"],
      };
      const resource = {
        updated_at: "2026-01-01T00:00:00Z",
        dependencies: {
          database: {
            max_connections: 100,
            opened_connections: 1,
            version: "16.0",
          },
        },
      };

      expect(
        authorization.filterOutput(currentUser, "read:status", resource)
          .dependencies.database.version,
      ).toBe("16.0");
    });

    test("Feature sem regra de saída específica retorna undefined", () => {
      expect(
        authorization.filterOutput(
          { features: ["read:unknown"] },
          "read:unknown",
          {},
        ),
      ).toBeUndefined();
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
        authorization.hasAdminSectionAccess(
          { features: ["read:audit"] },
          "audit",
        ),
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
