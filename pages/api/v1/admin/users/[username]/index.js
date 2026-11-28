import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";
import {
  uploadProfilePhoto,
  deleteProfilePhoto,
} from "@/lib/server/cloudinary.js";
import { ForbiddenError, ValidationError } from "@/infra/errors.js";

export const config = {
  api: { bodyParser: { sizeLimit: "3mb" } },
};

export default controller.createController(
  {
    GET: [controller.canRequest("read:user:others"), getHandler],
    PATCH: [authorizePatch, controller.requireJsonObjectBody(), patchHandler],
  },
  { middlewares: [controller.injectAnonymousOrUser] },
);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const userFound = await user.findOneByUsername(request.query.username);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:user:others",
    userFound,
  );

  return response.status(200).json(secureOutputValues);
}

function authorizePatch(request, response, next) {
  const body = request.body ?? {};
  const hasFeatures = Object.hasOwn(body, "features");
  const hasOtherFields = Object.keys(body).some(
    (field) => field !== "features",
  );
  const requiredFeatures = [];

  if (hasFeatures) requiredFeatures.push("update:user:features");
  if (!hasFeatures || hasOtherFields)
    requiredFeatures.push("update:user:others");

  for (const requiredFeature of requiredFeatures) {
    if (!authorization.can(request.context.user, requiredFeature)) {
      throw new ForbiddenError({
        message: "Você não possui permissão para executar esta ação.",
        action: `Verifique se o seu usuário possui a feature "${requiredFeature}".`,
      });
    }
  }

  return next();
}

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;
  const { profile_photo, ...userInputValues } = request.body;
  if (profile_photo !== undefined && typeof profile_photo !== "string") {
    throw new ValidationError({
      message: "A imagem de perfil enviada é inválida.",
      action: "Selecione uma imagem JPEG, PNG ou WebP válida.",
    });
  }

  const targetUser = await user.findOneByUsername(request.query.username);
  let uploadedPhoto = null;
  let updatedUser = targetUser;

  try {
    if (profile_photo)
      uploadedPhoto = await uploadProfilePhoto(profile_photo, targetUser.id);
    if (Object.keys(userInputValues).length > 0) {
      updatedUser = await user.update(request.query.username, userInputValues, {
        allowFeatures: true,
        allowPosition: true,
        actorUserId: userTryingToUpdate.id,
      });
    }
    if (uploadedPhoto) {
      updatedUser = await user.setProfilePhoto(targetUser.id, uploadedPhoto);
    }
  } catch (error) {
    if (
      uploadedPhoto &&
      uploadedPhoto.publicId !== targetUser.profile_photo_public_id
    ) {
      await deleteProfilePhoto(uploadedPhoto.publicId);
    }
    throw error;
  }

  if (
    uploadedPhoto &&
    targetUser.profile_photo_public_id &&
    targetUser.profile_photo_public_id !== uploadedPhoto.publicId
  ) {
    try {
      await deleteProfilePhoto(targetUser.profile_photo_public_id);
    } catch (error) {
      console.error("Falha ao excluir a imagem de perfil anterior:", error);
    }
  }

  const updatedUserWithPrivileges = await user.findOneById(updatedUser.id);

  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:user:others",
    updatedUserWithPrivileges,
  );

  return response.status(200).json(secureOutputValues);
}
