export const up = (pgm) => {
  pgm.addColumn("users", {
    deleted_at: {
      type: "timestamptz",
      notNull: false,
    },
  });
};

export const down = false;
