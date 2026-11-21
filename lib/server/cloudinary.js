import { v2 as cloudinary } from "cloudinary";

import { ConfigurationError, ValidationError } from "@/infra/errors.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MIN_DIMENSION = 128;
const MAX_DIMENSION = 2048;
const FOLDER = "profile-photos";

function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new ConfigurationError({
      message: "As credenciais do Cloudinary não estão configuradas.",
      action:
        "Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no ambiente do servidor.",
    });
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
    urlAnalytics: false,
  });
  return cloudinary;
}

function validateImage(buffer, mimeType) {
  let width;
  let height;
  if (mimeType === "image/png") {
    if (
      buffer.length < 24 ||
      !buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      throw new ValidationError({ message: "O arquivo não é um PNG válido." });
    }
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
    if (buffer.includes(Buffer.from("acTL")))
      throw new ValidationError({
        message: "Imagens animadas não são permitidas.",
      });
  } else if (mimeType === "image/jpeg") {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new ValidationError({ message: "O arquivo não é um JPEG válido." });
    }
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  } else if (mimeType === "image/webp") {
    if (
      buffer.length < 25 ||
      buffer.toString("ascii", 0, 4) !== "RIFF" ||
      buffer.toString("ascii", 8, 12) !== "WEBP"
    ) {
      throw new ValidationError({ message: "O arquivo WebP não é válido." });
    }
    const chunkType = buffer.toString("ascii", 12, 16);
    if (chunkType === "VP8X" && buffer.length >= 30) {
      if (buffer[20] & 0x02)
        throw new ValidationError({
          message: "Imagens animadas não são permitidas.",
        });
      width = 1 + buffer.readUIntLE(24, 3);
      height = 1 + buffer.readUIntLE(27, 3);
    } else if (chunkType === "VP8 " && buffer.length >= 30) {
      if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a)
        throw new ValidationError({ message: "O arquivo WebP não é válido." });
      width = buffer.readUInt16LE(26) & 0x3fff;
      height = buffer.readUInt16LE(28) & 0x3fff;
    } else if (
      chunkType === "VP8L" &&
      buffer.length >= 25 &&
      buffer[20] === 0x2f
    ) {
      const bits = buffer.readUInt32LE(21);
      width = 1 + (bits & 0x3fff);
      height = 1 + ((bits >> 14) & 0x3fff);
    } else {
      throw new ValidationError({
        message: "O arquivo WebP não possui dimensões verificáveis.",
      });
    }
    if (buffer.includes(Buffer.from("ANIM"))) {
      throw new ValidationError({
        message: "Imagens animadas não são permitidas.",
      });
    }
  }
  if (
    !width ||
    !height ||
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    throw new ValidationError({
      message: "As dimensões da imagem não são permitidas.",
      action:
        "Utilize uma imagem com largura e altura entre 128 e 2048 pixels.",
    });
  }
}

function decodeImage(dataUrl) {
  if (typeof dataUrl !== "string")
    throw new ValidationError({ message: "A imagem de perfil é inválida." });
  const match = dataUrl.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match)
    throw new ValidationError({
      message: "O formato da imagem não é permitido.",
      action: "Envie uma imagem JPEG, PNG ou WebP.",
    });
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FILE_SIZE)
    throw new ValidationError({
      message: "O tamanho da imagem não é permitido.",
      action: "Envie uma imagem com no máximo 2 MB.",
    });
  validateImage(buffer, match[1]);
  return { buffer, mimeType: match[1] };
}

async function uploadProfilePhoto(dataUrl, userId) {
  const { buffer, mimeType } = decodeImage(dataUrl);
  if (typeof userId !== "string" || !userId.trim()) {
    throw new ValidationError({
      message: "O identificador do usuário é inválido.",
    });
  }

  const cloudinaryClient = getCloudinary();
  const publicId = `${FOLDER}/${userId}`;
  try {
    const uploadResult = await cloudinaryClient.uploader.upload(
      `data:${mimeType};base64,${buffer.toString("base64")}`,
      {
        resource_type: "image",
        public_id: publicId,
        overwrite: true,
        invalidate: true,
      },
    );
  } catch {
    throw new Error(
      "Não foi possível enviar a imagem de perfil ao Cloudinary.",
    );
  }

  return {
    url: cloudinaryClient.url(publicId, {
      secure: true,
      version: uploadResult.version,
    }),
    publicId,
  };
}

async function deleteProfilePhoto(publicId) {
  if (typeof publicId !== "string" || !publicId.startsWith(`${FOLDER}/`))
    throw new ValidationError({
      message: "O identificador da imagem de perfil é inválido.",
    });
  const cloudinaryClient = getCloudinary();
  try {
    const result = await cloudinaryClient.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
    if (!["ok", "not found"].includes(result.result)) {
      throw new Error("Cloudinary não confirmou a remoção da imagem.");
    }
  } catch {
    throw new Error(
      "Não foi possível remover a imagem de perfil do Cloudinary.",
    );
  }
}

export { uploadProfilePhoto, deleteProfilePhoto };
