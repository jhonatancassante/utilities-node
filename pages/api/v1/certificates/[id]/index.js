import controller from "@/infra/controller.js";
import certificate from "@/models/certificate.js";
import authorization from "@/models/authorization.js";
import { ForbiddenError } from "@/infra/errors.js";

function canUpdateCertificate(request, response, next) {
  const userTryingToUpdate = request.context.user;
  const canUpdateOwn =
    userTryingToUpdate.features.includes("update:certificate");
  const canUpdateOthers = userTryingToUpdate.features.includes(
    "update:certificate:others",
  );

  if (canUpdateOwn || canUpdateOthers) return next();

  throw new ForbiddenError({
    message: "Você não possui permissão para alterar certidões.",
    action:
      'Solicite a feature "update:certificate" ou "update:certificate:others".',
  });
}

export default controller.createController(
  {
    GET: [controller.canRequest("read:certificate"), getHandler],
    PATCH: [canUpdateCertificate, patchHandler],
    DELETE: [controller.canRequest("delete:certificate"), deleteHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const record = await certificate.findOneById(request.query.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:certificate",
    record,
  );
  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;
  const existingRecord = await certificate.findOneById(request.query.id);
  if (
    !authorization.can(userTryingToUpdate, "update:certificate", existingRecord)
  ) {
    throw new ForbiddenError({
      message: "Você não possui permissão para alterar esta certidão.",
      action:
        "Para alterar esta certidão, solicite a permissão adequada ao administrador.",
    });
  }
  const record = await certificate.update(request.query.id, request.body);
  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:certificate",
    record,
  );
  return response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const record = await certificate.delete(request.query.id);
  const secureOutputValues = authorization.filterOutput(
    userTryingToDelete,
    "read:certificate",
    record,
  );
  return response.status(200).json(secureOutputValues);
}
