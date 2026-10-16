export const up = (pgm) => {
  pgm.renameColumn("users", "createdAt", "created_at");
  pgm.renameColumn("users", "updatedAt", "updated_at");
};

export const down = false;
