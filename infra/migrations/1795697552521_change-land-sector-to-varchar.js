export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE real_estate_properties
    ALTER COLUMN land_sector TYPE varchar(4)
    USING land_sector::varchar(4);
  `);
};

export const down = false;
