export const up = (pgm) => {
  pgm.addColumn("users", {
    banned_at: {
      type: "timestamptz",
    },
  });
};

export const down = false;
