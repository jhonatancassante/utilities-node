export const up = (pgm) => {
  pgm.addColumn("certificates", {
    physical_property_id: {
      type: "integer",
      notNull: false,
    },
  });

  pgm.sql(`
    UPDATE certificates AS certificate
    SET physical_property_id = property.physical_property_id
    FROM real_estate_properties AS property
    WHERE property.id = certificate.real_estate_property_id
  `);

  pgm.alterColumn("certificates", "physical_property_id", {
    notNull: true,
  });

  pgm.dropColumn("certificates", "real_estate_property_id");
};

export const down = false;
