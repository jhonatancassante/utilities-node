export const up = (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX real_estate_properties_current_physical_id_key
    ON real_estate_properties (physical_property_id)
    WHERE annual = false AND deleted_at IS NULL;

    CREATE UNIQUE INDEX real_estate_properties_annual_year_physical_id_key
    ON real_estate_properties (year, physical_property_id)
    WHERE annual = true AND deleted_at IS NULL;
  `);
};

export const down = false;
