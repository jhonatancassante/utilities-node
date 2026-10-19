import { createRouter } from "next-connect";
import * as cookie from "cookie";

import session from "@/models/session.js";
import {
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/infra/errors.js";

function createController(handlers) {
  const router = createRouter();

  for (const [method, handler] of Object.entries(handlers)) {
    router[method.toLowerCase()](handler);
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
  if (
    error instanceof NotFoundError ||
    error instanceof UnauthorizedError ||
    error instanceof ValidationError
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

const controller = {
  createController,
  setSessionCookie,
};

export default controller;
