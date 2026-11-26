import authorization from "@/models/authorization.js";

describe("Autorização de edição de certidões", () => {
  const ownCertificate = { user_id: "user-1" };
  const anotherCertificate = { user_id: "user-2" };

  test("update:certificate permite editar somente a própria certidão", () => {
    const user = { id: "user-1", features: ["update:certificate"] };

    expect(
      authorization.can(user, "update:certificate", ownCertificate),
    ).toBe(true);
    expect(
      authorization.can(user, "update:certificate", anotherCertificate),
    ).toBe(false);
  });

  test("update:certificate:others sozinho permite editar qualquer certidão", () => {
    const user = {
      id: "user-1",
      features: ["update:certificate:others"],
    };

    expect(
      authorization.can(user, "update:certificate", ownCertificate),
    ).toBe(true);
    expect(
      authorization.can(user, "update:certificate", anotherCertificate),
    ).toBe(true);
  });

  test("Sem as permissões de edição, nenhuma certidão pode ser alterada", () => {
    const user = { id: "user-1", features: ["read:certificate"] };

    expect(
      authorization.can(user, "update:certificate", ownCertificate),
    ).toBe(false);
    expect(
      authorization.can(user, "update:certificate", anotherCertificate),
    ).toBe(false);
  });
});
