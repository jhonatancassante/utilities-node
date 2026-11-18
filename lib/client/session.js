import requestAPI from "@/lib/client/api.js";

async function getCurrentUser() {
  try {
    return await requestAPI("/api/v1/user");
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 403) return null;
    throw error;
  }
}

async function login(email, password) {
  return requestAPI("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function logout() {
  return requestAPI("/api/v1/sessions", { method: "DELETE" });
}

const session = { getCurrentUser, login, logout };

export default session;
