import retry from "async-retry";
import { fakerPT_BR as faker } from "@faker-js/faker";
import * as cookie from "cookie";

import database from "@/infra/database.js";
import migrator from "@/models/migrator.js";
import user from "@/models/user.js";
import session from "@/models/session.js";
import webserver from "@/infra/webserver.js";
import activation from "@/models/activation";

const API_URL = `${webserver.origin}/api/v1`;
const EMAIL_HTTP_URL = "http://localhost:1080";

async function waitForAllServices() {
  await waitForWebServer();
  await waitForEmailServer();

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

  async function waitForEmailServer() {
    return retry(fetchEmailPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchEmailPage() {
      const response = await fetch(EMAIL_HTTP_URL);

      if (response.status !== 200) {
        throw new Error(`Email page returned ${response.status}`);
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

async function activateUser(user) {
  return await activation.activateUserByUserId(user.id);
}

async function createSession(userId) {
  return await session.create(userId);
}

async function deleteAllEmail() {
  await fetch(`${EMAIL_HTTP_URL}/messages`, {
    method: "DELETE",
  });
}

async function getLastEmail() {
  const emailListResponse = await fetch(`${EMAIL_HTTP_URL}/messages`);
  const emailListBody = await emailListResponse.json();
  const lastEmailItem = emailListBody.pop();

  if (!lastEmailItem) {
    return null;
  }

  const emailTextResponse = await fetch(
    `${EMAIL_HTTP_URL}/messages/${lastEmailItem.id}.plain`,
  );
  const emailTextBody = await emailTextResponse.text();

  lastEmailItem.text = emailTextBody;
  return lastEmailItem;
}

function getSessionCookieObject(response) {
  const setCookies = response.headers.getSetCookie();

  return setCookies
    .map((setCookie) => cookie.parseSetCookie(setCookie))
    .find((parsed) => parsed.name === "session_id");
}

function extractUUID(emailText) {
  const match = emailText.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/i,
  );

  return match ? match[0] : null;
}

const orchestrator = {
  API_URL,
  waitForAllServices,
  clearDatabase,
  runPendingMigrations,
  createUser,
  activateUser,
  createSession,
  deleteAllEmail,
  getLastEmail,
  getSessionCookieObject,
  extractUUID,
};

export default orchestrator;
