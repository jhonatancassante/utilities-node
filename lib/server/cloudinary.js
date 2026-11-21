import { createHash, randomUUID } from "node:crypto";

import { ConfigurationError, ValidationError } from "@/infra/errors.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MIN_DIMENSION = 128;
const MAX_DIMENSION = 2048;
const FOLDER = "profile-photos";

function getConfiguration() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new ConfigurationError({
      message: "As credenciais do Cloudinary não estão configuradas.",
      action: "Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no ambiente do servidor.",
    });
  }
  return { cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, apiSecret: CLOUDINARY_API_SECRET };
}

function signParameters(parameters, apiSecret) {
  const payload = Object.keys(parameters).sort().map((key) => `${key}=${parameters[key]}`).join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

function validateImage(buffer, mimeType) {
  let width;
  let height;
  if (mimeType === "image/png") {
    if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new ValidationError({ message: "O arquivo não é um PNG válido." });
    }
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
    if (buffer.includes(Buffer.from("acTL"))) throw new ValidationError({ message: "Imagens animadas não são permitidas." });
  } else if (mimeType === "image/jpeg") {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new ValidationError({ message: "O arquivo não é um JPEG válido." });
    }
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  } else if (mimeType === "image/webp") {
    if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP" || buffer.toString("ascii", 12, 16) !== "VP8X") {
      throw new ValidationError({ message: "O arquivo WebP não é válido ou não possui dimensões verificáveis." });
    }
    if (buffer[20] & 0x02) throw new ValidationError({ message: "Imagens animadas não são permitidas." });
    width = 1 + buffer.readUIntLE(24, 3);
    height = 1 + buffer.readUIntLE(27, 3);
  }
  if (!width || !height || width < MIN_DIMENSION || height < MIN_DIMENSION || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ValidationError({
      message: "As dimensões da imagem não são permitidas.",
      action: "Utilize uma imagem com largura e altura entre 128 e 2048 pixels.",
    });
  }
}

function decodeImage(dataUrl) {
  if (typeof dataUrl !== "string") throw new ValidationError({ message: "A imagem de perfil é inválida." });
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new ValidationError({
    message: "O formato da imagem não é permitido.",
    action: "Envie uma imagem JPEG, PNG ou WebP.",
  });
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FILE_SIZE) throw new ValidationError({
    message: "O tamanho da imagem não é permitido.",
    action: "Envie uma imagem com no máximo 2 MB.",
  });
  validateImage(buffer, match[1]);
  return { buffer, mimeType: match[1] };
}

async function uploadProfilePhoto(dataUrl) {
  const { buffer, mimeType } = decodeImage(dataUrl);
  const { cloudName, apiKey, apiSecret } = getConfiguration();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${FOLDER}/${randomUUID()}`;
  const parameters = { public_id: publicId, timestamp };
  const form = new FormData();
  form.set("file", new Blob([buffer], { type: mimeType }), "profile-photo");
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("public_id", publicId);
  form.set("signature", signParameters(parameters, apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error("Não foi possível enviar a imagem de perfil ao Cloudinary.");
  return {
    url: result.secure_url.replace("/image/upload/", "/image/upload/c_fill,ar_1:1,g_auto,w_256/"),
    publicId: result.public_id,
  };
}

async function deleteProfilePhoto(publicId) {
  if (typeof publicId !== "string" || !publicId.startsWith(`${FOLDER}/`)) throw new ValidationError({ message: "O identificador da imagem de perfil é inválido." });
  const { cloudName, apiKey, apiSecret } = getConfiguration();
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = { invalidate: true, public_id: publicId, timestamp };
  const form = new FormData();
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("public_id", publicId);
  form.set("invalidate", "true");
  form.set("signature", signParameters(parameters, apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok || !["ok", "not found"].includes(result.result)) throw new Error("Não foi possível remover a imagem de perfil do Cloudinary.");
}

export { uploadProfilePhoto, deleteProfilePhoto };
