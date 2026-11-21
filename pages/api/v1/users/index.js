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
  const userTryingToGet = request.context.user;
  const { profile_photo, ...userInputValues } = request.body ?? {};
  let uploadedPhoto = null;
  let newUser;

  try {
    if (profile_photo) {
      uploadedPhoto = await uploadProfilePhoto(profile_photo);
      userInputValues.profile_photo_url = uploadedPhoto.url;
      userInputValues.profile_photo_public_id = uploadedPhoto.publicId;
    }

    newUser = await user.create(userInputValues);
  } catch (error) {
    if (uploadedPhoto) await deleteProfilePhoto(uploadedPhoto.publicId);
    throw error;
  }

  const activationToken = await activation.create(newUser.id);
  await activation.sendEmailToUser(newUser, activationToken);

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:user",
    newUser,
  );

  return response.status(201).json(secureOutputValues);
}
