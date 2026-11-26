export const up = (pgm) => {
  pgm.alterColumn("certificates", "observations", {
    notNull: false,
  });
};

export const down = false;
