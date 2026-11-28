import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";
import { ForbiddenError, ValidationError } from "@/infra/errors.js";
import {
  uploadProfilePhoto,
  deleteProfilePhoto,
} from "@/lib/server/cloudinary.js";

export const config = {
  api: { bodyParser: { sizeLimit: "3mb" } },
};

export default controller.createController({
  GET: [controller.injectUserOrAnonymousOnInvalidSession, getHandler],
  PATCH: [
    controller.injectAnonymousOrUser,
    controller.canRequest("update:user"),
    controller.requireJsonObjectBody(),
    patchHandler,
  ],
});

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const username = request.query.username;
  const userFound = await user.findOneByUsername(username);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:user",
    userFound,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const username = request.query.username;
  const { profile_photo, ...userInputValues } = request.body;

  const userTryingToUpdate = request.context.user;
  const targetUser = await user.findOneByUsername(username);

  if (!authorization.can(userTryingToUpdate, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Você não possui permissão para executar esta ação.",
      action: 'Verifique se o seu usuário possui a feature "update:user".',
    });
  }

  if (profile_photo !== undefined && typeof profile_photo !== "string") {
    throw new ValidationError({
      message: "A imagem de perfil enviada é inválida.",
      action: "Selecione uma imagem JPEG, PNG ou WebP válida.",
    });
  }

  let uploadedPhoto = null;
  let updatedUser = targetUser;

  try {
    if (profile_photo)
      uploadedPhoto = await uploadProfilePhoto(profile_photo, targetUser.id);
    if (Object.keys(userInputValues).length > 0) {
      updatedUser = await user.update(username, userInputValues);
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

  const secureOutputValues = authorization.filterOutput(
    userTryingToUpdate,
    "read:user",
    updatedUser,
  );

  return response.status(200).json(secureOutputValues);
}
