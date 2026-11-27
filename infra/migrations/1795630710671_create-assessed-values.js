export const up = (pgm) => {
  pgm.createTable("assessed_values", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    year: {
      type: "integer",
      notNull: true,
    },
    decree: {
      type: "varchar(12)",
      notNull: false,
    },
    sector_1: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_2: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_3: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_4: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_5: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_6: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_7: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_8: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_9: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_9a: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_10: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_11: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_11a: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_11b: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_12: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_13: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_14: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_15: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_16: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    sector_17: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    residential_precarious: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    residential_simple: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    residential_regular: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    residential_medium: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    residential_good: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    residential_sophisticated: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    commercial_precarious: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    commercial_simple: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    commercial_regular: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    commercial_medium: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    commercial_good: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    commercial_sophisticated: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    industrial_precarious: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    industrial_simple: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    industrial_regular: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    industrial_medium: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    industrial_good: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    industrial_sophisticated: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    cleaning: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    garbage: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    rural: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    deleted_at: {
      type: "timestamptz",
      notNull: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });
};

export const down = false;
