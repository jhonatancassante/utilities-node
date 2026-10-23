import { createRouter } from "next-connect";
import * as cookie from "cookie";

import session from "@/models/session.js";
import user from "@/models/user.js";
import {
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConfigurationError,
  ForbiddenError,
} from "@/infra/errors.js";

function createController(handlers, { middlewares = [] } = {}) {
  const router = createRouter();

  if (middlewares.length > 0) {
    middlewares.forEach((middleware, index) => {
      if (typeof middleware !== "function") {
        throw new ConfigurationError({
          message: `O middleware na posição ${index} não é uma função.`,
          action:
            "Confira se o middleware está exportado corretamente e se o nome está correto.",
        });
      }
    });

    router.use(...middlewares);
  }

  for (const [method, handler] of Object.entries(handlers)) {
    const stack = Array.isArray(handler) ? handler : [handler];
    router[method.toLowerCase()](...stack);
  }

  const allowedMethods = Object.keys(handlers).join(", ");

  return router.handler({
    onNoMatch: createOnNoMatchHandler(allowedMethods),
    onError: onErrorHandler,
  });
}

function createOnNoMatchHandler(allowedMethods) {
  return function onNoMatchHandler(request, response) {
    const publicErrorObject = new MethodNotAllowedError();

    response.setHeader("Allow", allowedMethods);
    return response
      .status(publicErrorObject.statusCode)
      .json(publicErrorObject);
  };
}

function onErrorHandler(error, request, response) {
  if (error instanceof UnauthorizedError) {
    clearSessionCookie(response);
  }

  if (
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof ValidationError ||
    error instanceof UnauthorizedError
  ) {
    return response.status(error.statusCode).json(error);
  }

  const publicErrorObject = new InternalServerError({
    cause: error,
  });

  console.error(publicErrorObject);

  return response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

function setSessionCookie(response, sessionToken) {
  const setCookie = cookie.stringifySetCookie({
    name: "session_id",
    value: sessionToken,
    path: "/",
    maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  response.setHeader("Set-Cookie", setCookie);
  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );
}

function clearSessionCookie(response) {
  const setCookie = cookie.stringifySetCookie({
    name: "session_id",
    value: "invalid",
    path: "/",
    maxAge: -1,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  response.setHeader("Set-Cookie", setCookie);
  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );
}

async function injectAnonymousOrUser(request, response, next) {
  if (request.cookies?.session_id) {
    await injectAutheticatedUser(request);
  } else {
    injectAnonymousUser(request);
  }

  return next();
}

async function injectAutheticatedUser(request) {
  const sessionToken = request.cookies.session_id;
  const sessionObject = await session.findOneValidByToken(sessionToken);
  const userObject = await user.findOneById(sessionObject.user_id);

  request.context = {
    ...request.context,
    user: userObject,
  };
}

function injectAnonymousUser(request) {
  const anonymousUserObject = {
    features: ["create:session", "create:user", "read:activation_token"],
  };

  request.context = {
    ...request.context,
    user: anonymousUserObject,
  };
}

function canRequest(feature) {
  return function canRequestMiddleware(request, response, next) {
    const userTryingToRequest = request.context.user;

    if (userTryingToRequest.features.includes(feature)) {
      return next();
    }

    throw new ForbiddenError({
      message: "Você não possui permissão para executar esta ação.",
      action: `Verifique se o seu usuário possui a feature "${feature}".`,
    });
  };
}

const controller = {
  createController,
  setSessionCookie,
  clearSessionCookie,
  injectAnonymousOrUser,
  canRequest,
};

export default controller;
