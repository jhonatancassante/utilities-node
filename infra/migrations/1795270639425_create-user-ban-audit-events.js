export const up = (pgm) => {
  pgm.createTable("user_ban_events", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
    },
    actor_user_id: {
      type: "uuid",
    },
    action: {
      type: "varchar(10)",
      notNull: true,
    },
    username: {
      type: "varchar(30)",
      notNull: true,
    },
    email: {
      type: "varchar(254)",
      notNull: true,
    },
    account_created_at: {
      type: "timestamptz",
      notNull: true,
    },
    actor_username: {
      type: "varchar(30)",
    },
    actor_email: {
      type: "varchar(254)",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  pgm.addConstraint("user_ban_events", "user_ban_events_action_check", {
    check: "action IN ('ban', 'unban')",
  });

  pgm.createIndex("user_ban_events", "created_at");
  pgm.createIndex("user_ban_events", "user_id");

  pgm.sql(`
    INSERT INTO user_ban_events (
      user_id,
      action,
      username,
      email,
      account_created_at,
      created_at
    )
    SELECT
      id,
      'ban',
      username,
      email,
      created_at,
      banned_at
    FROM users
    WHERE banned_at IS NOT NULL;
  `);
};

export const down = false;
