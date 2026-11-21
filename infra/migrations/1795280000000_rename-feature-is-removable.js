export const up = (pgm) => {
  pgm.renameColumn("features", "is_removable", "is_self_removable");
};

export const down = (pgm) => {
  pgm.renameColumn("features", "is_self_removable", "is_removable");
};
