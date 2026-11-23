export const up = (pgm) => {
  pgm.addColumn("users", {
    timeout_until: {
      type: "timestamptz",
    },
  });
};

export const down = false;
