export const up = (pgm) => {
  pgm.addColumns("users", {
    profile_photo_url: {
      type: "text",
    },
    profile_photo_public_id: {
      type: "varchar(255)",
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumns("users", ["profile_photo_url", "profile_photo_public_id"]);
};
