export const payload = "Untranslated customer copy";
export const objectPayload = { value: "Untranslated object copy" };

const boundCopy = "Untranslated bound copy";
export function boundValue() {
  return boundCopy;
}

function innerValue() {
  return "Untranslated nested helper copy";
}

export function nestedValue() {
  return innerValue();
}
