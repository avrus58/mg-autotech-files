import {
  fileExpertAllowedExtensions,
  fileExpertAllowedExtensionsLabel,
  fileExpertMaxFileSize,
  fileExpertMaxFileSizeLabel,
  fileExpertTextLimits,
} from "@/lib/fileExpert/limits";
import {
  customerWorkflowT,
  type CustomerWorkflowTranslationKey,
} from "@/lib/i18n/customer-workflow-file-expert-translations";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";

export type FileExpertTextField = keyof typeof fileExpertTextLimits;

type FileExpertFieldLabelKey = Extract<
  CustomerWorkflowTranslationKey,
  | "fileExpertFieldBrand"
  | "fileExpertFieldModel"
  | "fileExpertFieldEngine"
  | "fileExpertFieldEcu"
  | "fileExpertFieldNotes"
>;

const fileExpertTextFieldLabelKeys: Record<
  FileExpertTextField,
  FileExpertFieldLabelKey
> = {
  brand: "fileExpertFieldBrand",
  model: "fileExpertFieldModel",
  engine: "fileExpertFieldEngine",
  ecuType: "fileExpertFieldEcu",
  customerNotes: "fileExpertFieldNotes",
};

export type FileExpertValidationDescriptor =
  | Readonly<{ key: "fileExpertEmptyFile" }>
  | Readonly<{
      key: "fileExpertFileTooLarge";
      params: Readonly<{ size: string }>;
    }>
  | Readonly<{
      key: "fileExpertUnsupportedFile";
      params: Readonly<{ extensions: string }>;
    }>
  | Readonly<{
      key: "fileExpertTextLimit";
      params: Readonly<{
        fieldKey: FileExpertFieldLabelKey;
        count: number;
      }>;
    }>
  | Readonly<{ key: "fileExpertUploadFile" }>;

export type FileExpertPageMessage =
  | Readonly<{
      type: "validation";
      descriptor: FileExpertValidationDescriptor;
    }>
  | Readonly<{ type: "raw"; text: string }>;

export type FileExpertFileCandidate = Readonly<{
  name: string;
  size: number;
}>;

export type FileExpertTextValues = Readonly<
  Record<FileExpertTextField, string>
>;

export function validateFileExpertSelection(
  file: FileExpertFileCandidate | null,
): FileExpertValidationDescriptor | null {
  if (!file) return null;
  if (file.size === 0) return { key: "fileExpertEmptyFile" };
  if (file.size > fileExpertMaxFileSize) {
    return {
      key: "fileExpertFileTooLarge",
      params: { size: fileExpertMaxFileSizeLabel },
    };
  }

  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = fileExpertAllowedExtensions.some((extension) =>
    lowerName.endsWith(extension),
  );
  if (!hasAllowedExtension) {
    return {
      key: "fileExpertUnsupportedFile",
      params: { extensions: fileExpertAllowedExtensionsLabel },
    };
  }

  return null;
}

export function getFileExpertTextLimitValidation(
  form: FileExpertTextValues,
): FileExpertValidationDescriptor | null {
  for (const field of Object.keys(
    fileExpertTextLimits,
  ) as FileExpertTextField[]) {
    const limit = fileExpertTextLimits[field];
    if (form[field].length > limit) {
      return {
        key: "fileExpertTextLimit",
        params: {
          fieldKey: fileExpertTextFieldLabelKeys[field],
          count: limit,
        },
      };
    }
  }

  return null;
}

export function fileExpertUploadRequiredValidation(): FileExpertValidationDescriptor {
  return { key: "fileExpertUploadFile" };
}

export function localizeFileExpertValidation(
  locale: LocaleCode,
  descriptor: FileExpertValidationDescriptor,
) {
  switch (descriptor.key) {
    case "fileExpertFileTooLarge":
      return customerWorkflowT(locale, descriptor.key, {
        size: descriptor.params.size,
      });
    case "fileExpertUnsupportedFile":
      return customerWorkflowT(locale, descriptor.key, {
        extensions: descriptor.params.extensions,
      });
    case "fileExpertTextLimit":
      return customerWorkflowT(locale, descriptor.key, {
        field: customerWorkflowT(locale, descriptor.params.fieldKey),
        count: descriptor.params.count.toLocaleString(intlLocaleByCode[locale]),
      });
    case "fileExpertEmptyFile":
    case "fileExpertUploadFile":
      return customerWorkflowT(locale, descriptor.key);
  }
}

export function localizeFileExpertPageMessage(
  locale: LocaleCode,
  message: FileExpertPageMessage,
) {
  // Server/customer leaves stay opaque; React renders this return value as
  // escaped text. Only trusted semantic validation descriptors are formatted.
  return message.type === "validation"
    ? localizeFileExpertValidation(locale, message.descriptor)
    : message.text;
}
