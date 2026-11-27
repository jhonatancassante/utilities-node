export const up = (pgm) => {
  pgm.addColumns("certificates", {
    issuer_name: {
      type: "varchar(150)",
      notNull: false,
    },
    issuer_position: {
      type: "varchar(60)",
      notNull: false,
    },
  });

  pgm.sql(
    "UPDATE certificates SET issuer_name = COALESCE(users.name, 'Não informado'), issuer_position = COALESCE(users.position, 'Não informado') FROM users WHERE certificates.user_id = users.id;",
  );

  pgm.sql(
    "UPDATE certificates SET issuer_name = COALESCE(issuer_name, 'Não informado'), issuer_position = COALESCE(issuer_position, 'Não informado') WHERE issuer_name IS NULL OR issuer_position IS NULL;",
  );

  pgm.alterColumn("certificates", "issuer_name", {
    notNull: true,
  });
  pgm.alterColumn("certificates", "issuer_position", {
    notNull: true,
  });
};

export const down = false;
