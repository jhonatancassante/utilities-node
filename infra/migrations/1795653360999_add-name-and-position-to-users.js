export const up = (pgm) => {
  pgm.addColumns("users", {
    name: {
      type: "varchar(150)",
      notNull: false,
    },
    position: {
      type: "varchar(60)",
      notNull: false,
    },
  });

  pgm.sql(`
    UPDATE users
    SET
      name = username,
      position = 'Não informado'
    WHERE
      name IS NULL
      OR position IS NULL;
  `);

  pgm.alterColumn("users", "name", {
    notNull: true,
  });

  pgm.alterColumn("users", "position", {
    notNull: true,
  });
};

export const down = false;
