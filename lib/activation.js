// lib/activation.js
import requestAPI from "@/lib/api.js";

async function activateAccount(tokenId) {
  return requestAPI(
    `/api/v1/activations/${encodeURIComponent(tokenId)}`,
    {
      method: "PATCH",
    },
  );
}

export default activateAccount;
