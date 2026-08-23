const LOCAL_REDIRECT_ORIGIN = "https://local-redirect.invalid";
const MAX_LOCAL_REDIRECT_LENGTH = 2_048;

const UNSAFE_LITERAL_CHARACTERS =
  /[\\\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/;
const MALFORMED_PERCENT_ESCAPE = /%(?![0-9a-f]{2})/i;
const UNSAFE_PERCENT_ESCAPE =
  /%(?:0[0-9a-f]|1[0-9a-f]|2[05f]|5c|7f|8[0-9a-f]|9[0-9a-f])/i;

/**
 * Returns one canonical same-origin path, or null when a value could be
 * interpreted as an external/network-path navigation after decoding.
 */
export function getSafeLocalRedirectPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_LOCAL_REDIRECT_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    UNSAFE_LITERAL_CHARACTERS.test(value) ||
    MALFORMED_PERCENT_ESCAPE.test(value) ||
    UNSAFE_PERCENT_ESCAPE.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value, LOCAL_REDIRECT_ORIGIN);
    if (
      parsed.origin !== LOCAL_REDIRECT_ORIGIN ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//")
    ) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
