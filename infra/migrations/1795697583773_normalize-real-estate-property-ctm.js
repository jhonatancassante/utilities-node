export const up = (pgm) => {
  pgm.sql(`
    UPDATE real_estate_properties
    SET ctm = substring(digits, 1, 2) || '.' ||
              substring(digits, 3, 5) || '.' ||
              substring(digits, 8, 4)
    FROM (
      SELECT
        id,
        regexp_replace(ctm, '[^0-9]', '', 'g') AS digits
      FROM real_estate_properties
    ) AS normalized
    WHERE real_estate_properties.id = normalized.id
      AND length(normalized.digits) = 11
      AND real_estate_properties.ctm <> (
        substring(normalized.digits, 1, 2) || '.' ||
        substring(normalized.digits, 3, 5) || '.' ||
        substring(normalized.digits, 8, 4)
      );
  `);
};

export const down = false;
