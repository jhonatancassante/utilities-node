export const up = (pgm) => {
  pgm.renameColumn("features", "is_removable", "is_self_removable");
};

export const down = false;
