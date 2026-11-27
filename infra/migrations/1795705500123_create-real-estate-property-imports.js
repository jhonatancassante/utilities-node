export const up = (pgm) => {
  pgm.createTable("real_estate_property_imports", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    total_records: {
      type: "integer",
      notNull: true,
    },
    total_chunks: {
      type: "integer",
      notNull: true,
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "receiving",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    expires_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now() + interval '24 hours'"),
    },
  });

  pgm.createIndex("real_estate_property_imports", "expires_at");

  pgm.createTable("real_estate_property_import_chunks", {
    import_id: {
      type: "uuid",
      notNull: true,
      references: "real_estate_property_imports",
      onDelete: "CASCADE",
    },
    chunk_index: {
      type: "integer",
      notNull: true,
    },
    records: {
      type: "jsonb",
      notNull: true,
    },
    record_count: {
      type: "integer",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  pgm.addConstraint(
    "real_estate_property_import_chunks",
    "real_estate_property_import_chunks_pkey",
    {
      primaryKey: ["import_id", "chunk_index"],
    },
  );
};

export const down = (pgm) => {
  pgm.dropTable("real_estate_property_import_chunks");
  pgm.dropTable("real_estate_property_imports");
};
