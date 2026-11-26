import controller from "@/infra/controller.js";
import certificate from "@/models/certificate.js";
import authorization from "@/models/authorization.js";
import { ForbiddenError } from "@/infra/errors.js";

export default controller.createController(
  {
    GET: [controller.canRequest("read:certificate"), getHandler],
    PATCH: [
      controller.canRequest("update:certificate"),
      patchHandler,
    ],
    DELETE: [
      controller.canRequest("delete:certificate"),
      deleteHandler,
    ],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const currentUser = request.context.user;
  const record = await certificate.findOneById(request.query.id);
  const output = authorization.filterOutput(
    currentUser,
    "read:certificate",
    record,
  );
  return response.status(200).json(output);
}

async function patchHandler(request, response) {
  const currentUser = request.context.user;
  const existingRecord = await certificate.findOneById(request.query.id);
  if (!authorization.can(currentUser, "update:certificate", existingRecord)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para alterar esta certidão.",
      action:
        "Para alterar certidões de outros usuários, solicite a feature correspondente.",
    });
  }
  const record = await certificate.update(request.query.id, request.body);
  const output = authorization.filterOutput(
    currentUser,
    "read:certificate",
    record,
  );
  return response.status(200).json(output);
}

async function deleteHandler(request, response) {
  const currentUser = request.context.user;
  const record = await certificate.delete(request.query.id);
  const output = authorization.filterOutput(
    currentUser,
    "read:certificate",
    record,
  );
  return response.status(200).json(output);
}
