import { Client } from "pg";
import { ConfigurationError, ServiceError } from "./errors.js";

function getConfig() {
  const isDevelopment =
    process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

  //local (desenvolvimento)
  if (isDevelopment) {
    return {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      user: process.env.POSTGRES_USER,
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
    };
  }

  //Vercel (produção e preview)
  if (!process.env.DATABASE_URL) {
    throw new ConfigurationError({
      message: `DATABASE_URL não definida (ambiente: ${process.env.NODE_ENV}).`,
      action: "Defina a variável de ambiente DATABASE_URL no servidor.",
    });
  }

  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("sslmode", "verify-full");
  return { connectionString: url.toString() };
}

async function query(queryObject) {
  let client;
  try {
    client = await getNewClient();
    return await client.query(queryObject);
  } catch (error) {
    throw new ServiceError({
      message: "Erro na conexão com o banco de dados ou na query.",
      cause: error,
    });
  } finally {
    await client?.end();
  }
}

async function transaction(callback) {
  let client;
  try {
    client = await getNewClient();
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});

    if (error?.statusCode) throw error;

    throw new ServiceError({
      message: "Erro na conexão com o banco de dados ou na transação.",
      cause: error,
    });
  } finally {
    await client?.end();
  }
}

async function getNewClient() {
  const client = new Client(getConfig());
  await client.connect();
  return client;
}

const database = {
  query,
  transaction,
  getNewClient,
};

export default database;
