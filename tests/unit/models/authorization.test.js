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

    test("Com uma `feature` desconhecida", () => {
      const createdUser = {
        features: [],
      };
      expect(() => {
        authorization.can(createdUser, "unknown:feature");
      }).toThrow(InternalServerError);
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

    test("Com uma `feature` desconhecida", () => {
      const createdUser = {
        features: [],
      };
      expect(() => {
        authorization.filterOutput(createdUser, "unknown:feature");
      }).toThrow(InternalServerError);
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
  });
});
