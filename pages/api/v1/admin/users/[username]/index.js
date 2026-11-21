import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";
import {
  uploadProfilePhoto,
  deleteProfilePhoto,
} from "@/lib/server/cloudinary.js";
import { ValidationError } from "@/infra/errors.js";

export const config = {
  api: { bodyParser: { sizeLimit: "3mb" } },
};

export default controller.createController(
  {
    GET: [controller.canRequest("read:user:others"), getHandler],
    PATCH: [
      controller.canRequest("update:user:others"),
      controller.canRequest("read:user:others"),
      patchHandler,
    ],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
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

async function patchHandler(request, response) {
  const userTryingToUpdate = request.context.user;
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  ) {
    throw new ValidationError({
      message: "O corpo da requisição deve ser um objeto JSON.",
      action: "Envie um objeto com os campos a serem alterados.",
    });
  }
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
