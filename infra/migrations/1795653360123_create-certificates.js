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
      references: "users",
    },
    protocol_number: {
      type: "varchar(6)",
      notNull: true,
    },
    protocol_year: {
      type: "integer",
      notNull: true,
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
      references: "real_estate_properties",
    },
    property_number: {
      type: "numeric",
      notNull: true,
    },
    applicant_rg: {
      type: "varchar(20)",
      notNull: false,
    },
    observations: {
      type: "varchar(150)",
      notNull: false,
    },
    validity_days: {
      type: "integer",
      notNull: true,
      default: 30,
    },
    is_updated: {
      type: "boolean",
      notNull: true,
      default: true,
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
    ADD CONSTRAINT certificates_protocol_number_format_check
    CHECK (protocol_number ~ '^[0-9]{1,6}$');

    ALTER TABLE certificates
    ADD CONSTRAINT certificates_protocol_year_check
    CHECK (protocol_year BETWEEN 1900 AND 9999);

    ALTER TABLE certificates
    ADD CONSTRAINT certificates_validity_days_check
    CHECK (validity_days > 0);
  `);
};

export const down = false;
