export const CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH = 12;
export const CUSTOMER_REPLACEMENT_PASSWORD_MAX_LENGTH = 128;

export type CustomerPasswordValidation = {
  valid: boolean;
  errors: string[];
};

const commonPasswords = new Set([
  "password123!",
  "password1234!",
  "mgautotech123!",
  "changeme123!",
]);

export function validateCustomerReplacementPassword(
  value: string
): CustomerPasswordValidation {
  const errors: string[] = [];

  if (value.length < CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH} characters.`);
  }
  if (value.length > CUSTOMER_REPLACEMENT_PASSWORD_MAX_LENGTH) {
    errors.push(`Use no more than ${CUSTOMER_REPLACEMENT_PASSWORD_MAX_LENGTH} characters.`);
  }
  if (/\s/.test(value)) errors.push("Do not use spaces.");
  if (!/[a-z]/.test(value)) errors.push("Add a lowercase letter.");
  if (!/[A-Z]/.test(value)) errors.push("Add an uppercase letter.");
  if (!/[0-9]/.test(value)) errors.push("Add a number.");
  if (!/[^A-Za-z0-9\s]/.test(value)) errors.push("Add a symbol.");
  if (commonPasswords.has(value.toLowerCase())) {
    errors.push("Choose a less predictable password.");
  }

  return { valid: errors.length === 0, errors };
}

function secureRandomIndex(length: number) {
  if (length <= 0) throw new Error("Password character pool is empty.");
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] % length;
}

export function generateCustomerReplacementPassword(length = 18) {
  const safeLength = Math.max(
    CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH,
    Math.min(length, 64)
  );
  const pools = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%*-_=+",
  ];
  const allCharacters = pools.join("");
  const characters = pools.map(
    (pool) => pool[secureRandomIndex(pool.length)]
  );

  while (characters.length < safeLength) {
    characters.push(allCharacters[secureRandomIndex(allCharacters.length)]);
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}
