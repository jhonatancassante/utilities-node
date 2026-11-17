// features/cpf-tester/lib/cpf.js

export function formatCpf(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function calculateVerifiers(base) {
  if (!/^\d{9}$/.test(base)) return "";

  let sum = 0;
  for (let index = 0; index < 9; index++) {
    sum += Number(base[index]) * (10 - index);
  }

  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;

  const baseWithFirstDigit = base + firstDigit;
  sum = 0;
  for (let index = 0; index < 10; index++) {
    sum += Number(baseWithFirstDigit[index]) * (11 - index);
  }

  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;

  return String(firstDigit) + String(secondDigit);
}

export function isValidCpf(value) {
  if (!/^\d{11}$/.test(value)) return false;
  if (/^(\d)\1{10}$/.test(value)) return false;

  return value.slice(9) === calculateVerifiers(value.slice(0, 9));
}

export function generateCpfVariations(originalCpf) {
  if (!/^\d{11}$/.test(originalCpf)) return [];

  const results = [];
  const uniqueCpfs = new Set();
  const digits = originalCpf.split("");

  for (let position = 0; position < digits.length; position++) {
    for (let digit = 0; digit <= 9; digit++) {
      const candidateDigits = [...digits];
      candidateDigits[position] = String(digit);
      const candidateCpf = candidateDigits.join("");

      if (isValidCpf(candidateCpf) && !uniqueCpfs.has(candidateCpf)) {
        uniqueCpfs.add(candidateCpf);
        results.push({
          cpf: candidateCpf,
          isOriginal: candidateCpf === originalCpf,
          changedIndex: candidateCpf === originalCpf ? null : position,
        });
      }
    }
  }

  return results;
}
