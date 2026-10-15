import { createRouter } from "next-connect";

import {
  InternalServerError,
  MethodNotAllowedError,
  ValidationError,
} from "@/infra/errors.js";

function createController(handlers) {
  const router = createRouter();

  for (const [method, handler] of Object.entries(handlers)) {
    router[method.toLowerCase()](handler);
  }

  const allowedMethods = Object.keys(handlers).join(", ");

  return router.handler({
    onNoMatch: (request, response) => {
      const publicErrorObject = new MethodNotAllowedError();

      response.setHeader("Allow", allowedMethods);
      return response
        .status(publicErrorObject.statusCode)
        .json(publicErrorObject);
    },

    onError: (error, request, response) => {
      if (error instanceof ValidationError) {
        return response.status(error.statusCode).json(error);
      }

      const publicErrorObject = new InternalServerError({
        statusCode: error.statusCode,
        cause: error,
      });

      console.error(publicErrorObject);

      return response
        .status(publicErrorObject.statusCode)
        .json(publicErrorObject);
    },
  });
}

const controller = {
  createController,
};

export default controller;
