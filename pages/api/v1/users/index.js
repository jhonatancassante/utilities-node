import { randomUUID } from "node:crypto";

import controller from "@/infra/controller.js";
import activation from "@/models/activation.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";
import {
  uploadProfilePhoto,
  deleteProfilePhoto,
} from "@/lib/server/cloudinary.js";

export const config = {
  api: { bodyParser: { sizeLimit: "3mb" } },
};

export default controller.createController(
  {
    POST: [controller.canRequest("create:user"), postHandler],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function postHandler(request, response) {
  const userTryingToCreate = request.context.user;
  const { profile_photo, ...userInputValues } = request.body ?? {};
  delete userInputValues.id;
  delete userInputValues.profile_photo_url;
  delete userInputValues.profile_photo_public_id;
  let uploadedPhoto = null;
  let newUser;

  try {
    if (profile_photo) {
      userInputValues.id = randomUUID();
      uploadedPhoto = await uploadProfilePhoto(
        profile_photo,
        userInputValues.id,
      );
      userInputValues.profile_photo_url = uploadedPhoto.url;
      userInputValues.profile_photo_public_id = uploadedPhoto.publicId;
    }

    newUser = await user.create(userInputValues);
  } catch (error) {
    if (uploadedPhoto) {
      await deleteProfilePhoto(uploadedPhoto.publicId);
    }
    throw error;
  }

  const activationToken = await activation.create(newUser.id);
  await activation.sendEmailToUser(newUser, activationToken);

  const secureOutputValues = authorization.filterOutput(
    userTryingToCreate,
    "read:user",
    newUser,
  );

  return response.status(201).json(secureOutputValues);
}
