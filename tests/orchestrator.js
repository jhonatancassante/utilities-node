import retry from "async-retry";
import { fakerPT_BR as faker } from "@faker-js/faker";
import * as cookie from "cookie";

import database from "@/infra/database.js";
import migrator from "@/models/migrator.js";
import user from "@/models/user.js";
import session from "@/models/session.js";

const API_URL = "http://localhost:3000/api/v1";

async function waitForAllServices() {
  await waitForWebServer();

  async function waitForWebServer() {
    return retry(fetchStatusPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchStatusPage() {
      const response = await fetch(`${API_URL}/status`);

      if (response.status !== 200) {
        throw new Error(`Status page returned ${response.status}`);
      }
    }
  }
}

async function clearDatabase() {
  await database.query(
    "drop schema if exists public cascade; create schema public;",
  );
}

async function runPendingMigrations() {
  await migrator.runPendingMigrations();
}

async function createUser(userObject = {}) {
  return await user.create({
    username:
      userObject.username || faker.internet.username().replace(/[_.-]/g, ""),
    email: userObject.email || faker.internet.email(),
    password: userObject.password || "Senha_Padrao_V@l1d@_1234",
  });
}

async function createSession(userId) {
  return await session.create(userId);
}

function getSessionCookieObject(response) {
  const setCookies = response.headers.getSetCookie();

  return setCookies
    .map((setCookie) => cookie.parseSetCookie(setCookie))
    .find((parsed) => parsed.name === "session_id");
}

const orchestrator = {
  API_URL,
  waitForAllServices,
  clearDatabase,
  runPendingMigrations,
  createUser,
  createSession,
  getSessionCookieObject,
};

export default orchestrator;
