import {
  getAvailableAdminSections,
  hasAdminAccess,
  hasAdminSectionAccess,
} from "@/configs/admin.js";

describe("configs/admin.js", () => {
  describe(".hasAdminAccess()", () => {
    test("Usuário sem features privilegiadas", () => {
      expect(hasAdminAccess({ features: ["read:user"] })).toBe(false);
    });

    test("Usuário com qualquer feature privilegiada", () => {
      expect(hasAdminAccess({ features: ["read:status:all"] })).toBe(true);
      expect(hasAdminAccess({ features: ["update:user:others"] })).toBe(true);
    });
  });

  describe(".hasAdminSectionAccess()", () => {
    test("Usuário sem a feature exigida para a seção", () => {
      expect(
        hasAdminSectionAccess({ features: ["read:status:all"] }, "users"),
      ).toBe(false);
    });

    test("Usuário com a feature exigida para a seção", () => {
      expect(
        hasAdminSectionAccess(
          { features: ["update:user:others"] },
          "users",
        ),
      ).toBe(true);
    });

    test("Seção inexistente", () => {
      expect(hasAdminSectionAccess({ features: [] }, "unknown")).toBe(false);
    });
  });

  describe(".getAvailableAdminSections()", () => {
    test("Disponibiliza somente o gerenciamento de usuários", () => {
      const sections = getAvailableAdminSections({
        features: ["update:user:others"],
      });

      expect(sections.map((section) => section.id)).toEqual(["users"]);
    });

    test("Disponibiliza somente o status para a feature correspondente", () => {
      const sections = getAvailableAdminSections({
        features: ["read:status:all"],
      });

      expect(sections.map((section) => section.id)).toEqual(["status"]);
    });

    test("Disponibiliza todas as seções quando possui as duas features", () => {
      const sections = getAvailableAdminSections({
        features: ["update:user:others", "read:status:all"],
      });

      expect(sections.map((section) => section.id)).toEqual([
        "users",
        "status",
      ]);
    });

    test("Não disponibiliza seções sem permissões", () => {
      expect(getAvailableAdminSections({ features: [] })).toEqual([]);
    });
  });
});
