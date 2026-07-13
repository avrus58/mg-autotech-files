export const fileExpertTextLimits = {
  brand: 100,
  model: 100,
  engine: 100,
  ecuType: 120,
  customerNotes: 2000,
} as const;

export const fileExpertAllowedExtensions = [".bin", ".ori", ".mod", ".frf", ".hex", ".zip"] as const;
export const fileExpertAllowedExtensionsLabel = fileExpertAllowedExtensions.join(", ");
export const fileExpertMaxFileSize = 32 * 1024 * 1024;
export const fileExpertMaxFileSizeLabel = "32 MB";
