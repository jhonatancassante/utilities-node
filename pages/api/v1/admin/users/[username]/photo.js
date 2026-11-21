import controller from "@/infra/controller.js";
import user from "@/models/user.js";
import authorization from "@/models/authorization.js";
import { deleteProfilePhoto } from "@/lib/server/cloudinary.js";

export default controller.createController(
  {
    DELETE: [
      controller.canRequest("update:user:others"),
      controller.canRequest("read:user:others"),
      deleteHandler,
    ],
  },
  { middlewares: [controller.injectUserOrAnonymousOnInvalidSession] },
);

async function deleteHandler(request, response) {
  const targetUser = await user.findOneByUsername(request.query.username);
  const updatedUser = await user.setProfilePhoto(targetUser.id, null);

  if (targetUser.profile_photo_public_id) {
    try {
      await deleteProfilePhoto(targetUser.profile_photo_public_id);
    } catch (error) {
      try {
        await user.setProfilePhoto(targetUser.id, {
          url: targetUser.profile_photo_url,
          publicId: targetUser.profile_photo_public_id,
        });
      } catch (restoreError) {
        console.error(
          "Falha ao restaurar a referência da foto após erro no Cloudinary:",
          restoreError,
        );
      }
      throw error;
    }
  }

  const secureOutputValues = authorization.filterOutput(
    request.context.user,
    "read:user:others",
    updatedUser,
  );
  return response.status(200).json(secureOutputValues);
}
