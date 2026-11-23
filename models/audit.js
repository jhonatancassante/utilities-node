import database from "@/infra/database.js";

async function findBanEvents() {
  const results = await database.query({
    text: `
      SELECT
        events.id,
        events.user_id,
        events.actor_user_id,
        events.action,
        events.username,
        events.email,
        events.account_created_at,
        events.actor_username,
        events.actor_email,
        events.created_at,
        COALESCE(users.banned_at IS NOT NULL, false) AS is_currently_banned,
        users.banned_at AS current_banned_at
      FROM
        user_ban_events AS events
      LEFT JOIN
        users
        ON users.id = events.user_id
      ORDER BY
        events.created_at DESC,
        events.id DESC
      ;
    `,
  });

  return results.rows;
}

async function findMigrationEvents() {
  const results = await database.query({
    text: `
      SELECT
        id,
        name,
        run_on AT TIME ZONE 'UTC' AS run_on
      FROM
        pgmigrations
      ORDER BY
        run_on DESC,
        id DESC
      ;
    `,
  });

  return results.rows;
}

const audit = {
  findBanEvents,
  findMigrationEvents,
};

export default audit;
