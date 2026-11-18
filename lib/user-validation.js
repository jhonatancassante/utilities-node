const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 64;

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const COMMON_TERMS = [
  "password",
  "senha",
  "admin",
  "qwerty",
  "letmein",
  "welcome",
];

function validateUsername(username) {
  if (typeof username !== "string" || !username.trim()) {
    return {
      message: "O nome de usuário é obrigatório.",
      action: "Informe um nome de usuário para continuar.",
    };
  }

  const cleanUsername = username.trim();
  const length = Array.from(cleanUsername).length;

  if (length < USERNAME_MIN_LENGTH) {
    return {
      message: "O nome de usuário deve ter pelo menos 3 caracteres.",
      action: "Escolha um nome de usuário com 3 a 30 caracteres.",
    };
  }

  if (length > USERNAME_MAX_LENGTH) {
    return {
      message: "O nome de usuário deve ter no máximo 30 caracteres.",
      action: "Reduza o nome de usuário para até 30 caracteres.",
    };
  }

  if (!USERNAME_PATTERN.test(cleanUsername)) {
    return {
      message: "O nome de usuário contém caracteres não permitidos.",
      action:
        "Utilize somente letras sem acento, números, hífen (-) e sublinhado (_).",
    };
  }

  return null;
}

function validateEmail(email) {
  if (typeof email !== "string" || !email.trim()) {
    return {
      message: "O e-mail é obrigatório.",
      action: "Informe um endereço de e-mail válido.",
    };
  }

  const cleanEmail = email.trim();

  if (cleanEmail.length > EMAIL_MAX_LENGTH) {
    return {
      message: "O e-mail deve ter no máximo 254 caracteres.",
      action: "Utilize um endereço de e-mail mais curto.",
    };
  }

  const [localPart, domain, ...extraParts] = cleanEmail.split("@");

  if (
    extraParts.length > 0 ||
    !localPart ||
    localPart.length > 64 ||
    !domain ||
    cleanEmail.includes("..") ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    !EMAIL_PATTERN.test(cleanEmail)
  ) {
    return {
      message: "O e-mail informado não possui um formato válido.",
      action:
        "Verifique se digitou o e-mail corretamente (ex: nome@dominio.com).",
    };
  }

  return null;
}

function matchesCommonPhrase(candidate) {
  return COMMON_TERMS.some(
    (term) =>
      candidate === term.repeat(2) ||
      candidate === term.repeat(3) ||
      candidate === `${term}123456789` ||
      candidate === `${term}1234567890`,
  );
}

function validatePassword(password) {
  if (typeof password !== "string" || !password) {
    return {
      message: "A senha é obrigatória.",
      action: "Informe uma senha para continuar.",
    };
  }

  const normalizedValue = password.normalize("NFC");
  const length = Array.from(normalizedValue).length;

  if (length < PASSWORD_MIN_LENGTH) {
    return {
      message: "A senha deve ter pelo menos 12 caracteres.",
      action: "Utilize uma senha com pelo menos 12 caracteres.",
    };
  }

  if (length > PASSWORD_MAX_LENGTH) {
    return {
      message: "A senha deve ter no máximo 64 caracteres.",
      action: "Reduza a senha para até 64 caracteres.",
    };
  }

  const lowercaseCount = normalizedValue.match(/\p{Ll}/gu)?.length ?? 0;
  const uppercaseCount = normalizedValue.match(/\p{Lu}/gu)?.length ?? 0;
  const numberCount = normalizedValue.match(/\p{N}/gu)?.length ?? 0;
  const specialCount = normalizedValue.match(/[\p{P}\p{S}]/gu)?.length ?? 0;

  if (lowercaseCount < 2) {
    return {
      message: "A senha deve conter pelo menos 2 letras minúsculas.",
      action: "Adicione pelo menos 2 letras de a a z em minúsculo.",
    };
  }

  if (uppercaseCount < 2) {
    return {
      message: "A senha deve conter pelo menos 2 letras maiúsculas.",
      action: "Adicione pelo menos 2 letras de A a Z em maiúsculo.",
    };
  }

  if (numberCount < 2) {
    return {
      message: "A senha deve conter pelo menos 2 números.",
      action: "Adicione pelo menos 2 números.",
    };
  }

  if (specialCount < 2) {
    return {
      message: "A senha deve conter pelo menos 2 caracteres especiais.",
      action: "Adicione pelo menos 2 símbolos ou sinais de pontuação.",
    };
  }

  if (matchesCommonPhrase(normalizedValue.toLocaleLowerCase("en-US"))) {
    return {
      message: "A senha escolhida é muito comum e não pode ser utilizada.",
      action: "Escolha uma senha exclusiva e difícil de adivinhar.",
    };
  }

  return null;
}

export {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  validateUsername,
  validateEmail,
  validatePassword,
};
