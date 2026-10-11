import { Client } from "pg";

function getConfig() {
  //local (desenvolvimento)
  if (process.env.NODE_ENV === "development") {
    return {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      user: process.env.POSTGRES_USER,
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
    };
  }

  //Vercel (produção e preview)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("sslmode", "verify-full");
  return { connectionString: url.toString() };
}

const query = async (queryObject) => {
  const client = new Client(getConfig());

  try {
    await client.connect();
    const result = await client.query(queryObject);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await client.end();
  }
};

export default {
  query,
};
