import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";
import { ValidationError } from "@/infra/errors.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:user:others"), getHandler],
    POST: [
      controller.canRequest("update:user:status"),
      postHandler,
    ],
    DELETE: [
      controller.canRequest("update:user:status"),
      deleteHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  await user.validateStatusChangeEligibility(request.query.username);
  return response.status(200).json({ allowed: true });
}

async function postHandler(request, response) {
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body) ||
    typeof request.body.timeout_until !== "string"
  ) {
    throw new ValidationError({
      message: "Informe a data e hora de término do timeout.",
      action: "Envie timeout_until como uma data/hora ISO 8601 futura.",
    });
  }

  return updateTimeout(request, response, request.body.timeout_until);
}

async function deleteHandler(request, response) {
  return updateTimeout(request, response, null);
}

async function updateTimeout(request, response, timeoutUntil) {
  const userTryingToUpdate = request.context.user;
  const updatedUser = await user.setTimeoutStatus(
    request.query.username,
    timeoutUntil,
    userTryingToUpdate.id,
  );
  const updatedUserWithPrivileges = await user.findOneById(updatedUser.id);

  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:user:others",
    updatedUserWithPrivileges,
  );

  return response.status(200).json(secureOutputValues);
}
