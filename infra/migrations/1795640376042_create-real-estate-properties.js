export const up = (pgm) => {
  pgm.createTable("real_estate_properties", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    year: {
      type: "integer",
      notNull: true,
      default: pgm.func("EXTRACT(YEAR FROM CURRENT_DATE)::integer"),
    },
    physical_property_id: {
      type: "integer",
      notNull: true,
    },
    physical_registration: {
      type: "text",
      notNull: true,
    },
    ctm: {
      type: "text",
      notNull: true,
    },
    ctm_count: {
      type: "integer",
      notNull: true,
    },
    grouping: {
      type: "varchar(1)",
      notNull: true,
    },
    property_block: {
      type: "varchar(20)",
      notNull: false,
    },
    property_lots: {
      type: "varchar(20)",
      notNull: false,
    },
    land_area: {
      type: "numeric(12, 2)",
      notNull: true,
    },
    built_area: {
      type: "numeric(12, 2)",
      notNull: true,
      default: 0,
    },
    property_neighborhood: {
      type: "varchar(50)",
      notNull: true,
    },
    owner_name: {
      type: "varchar(150)",
      notNull: true,
    },
    promissory_buyer: {
      type: "varchar(150)",
      notNull: false,
    },
    land_sector: {
      type: "integer",
      notNull: true,
    },
    property_street: {
      type: "varchar(150)",
      notNull: true,
    },
    property_number: {
      type: "numeric",
      notNull: false,
    },
    property_complement: {
      type: "varchar(150)",
      notNull: false,
    },
    construction_type: {
      type: "integer",
      notNull: false,
    },
    ideal_fraction: {
      type: "numeric(12, 2)",
      notNull: false,
    },
    points: {
      type: "integer",
      notNull: false,
    },
    annual: {
      type: "boolean",
      notNull: true,
      default: false,
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
