export const up = (pgm) => {
  pgm.createTable("certificates", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
    },
    protocol_number: {
      type: "integer",
      notNull: false,
    },
    protocol_year: {
      type: "integer",
      notNull: false,
    },
    applicant_name: {
      type: "varchar(150)",
      notNull: true,
    },
    year: {
      type: "integer",
      notNull: true,
      default: pgm.func("EXTRACT(YEAR FROM CURRENT_DATE)::integer"),
    },
    purpose: {
      type: "varchar(50)",
      notNull: true,
    },
    real_estate_property_id: {
      type: "uuid",
      notNull: true,
    },
    physical_registration: {
      type: "text",
      notNull: true,
    },
    owner_name: {
      type: "varchar(150)",
      notNull: true,
    },
    promissory_buyer: {
      type: "varchar(150)",
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
    property_neighborhood: {
      type: "varchar(70)",
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
    property_complement: {
      type: "varchar(150)",
      notNull: false,
    },
    owner_rg: {
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
    },
    land_value: {
      type: "numeric(12, 2)",
      notNull: true,
    },
    building_value: {
      type: "numeric(12, 2)",
      notNull: true,
    },
    total_value: {
      type: "numeric(12, 2)",
      notNull: true,
    },
    observations: {
      type: "varchar(150)",
      notNull: true,
    },
    validity_days: {
      type: "integer",
      notNull: true,
      default: 30,
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

  pgm.sql(`
    ALTER TABLE certificates
    ADD CONSTRAINT certificates_validity_days_check
    CHECK (validity_days > 0);
  `);
};

export const down = false;
