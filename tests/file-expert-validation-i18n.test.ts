import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  fileExpertUploadRequiredValidation,
  getFileExpertTextLimitValidation,
  localizeFileExpertPageMessage,
  localizeFileExpertValidation,
  validateFileExpertSelection,
} from "../src/lib/fileExpert/validation";
import {
  fileExpertAllowedExtensionsLabel,
  fileExpertMaxFileSize,
  fileExpertMaxFileSizeLabel,
  fileExpertTextLimits,
} from "../src/lib/fileExpert/limits";

test("File Expert stores canonical file validation descriptors after invalid files are cleared", () => {
  assert.deepEqual(
    validateFileExpertSelection({ name: "empty.bin", size: 0 }),
    { key: "fileExpertEmptyFile" },
  );
  assert.deepEqual(
    validateFileExpertSelection({
      name: "oversize.bin",
      size: fileExpertMaxFileSize + 1,
    }),
    {
      key: "fileExpertFileTooLarge",
      params: { size: fileExpertMaxFileSizeLabel },
    },
  );
  assert.deepEqual(
    validateFileExpertSelection({ name: "calibration.exe", size: 1_024 }),
    {
      key: "fileExpertUnsupportedFile",
      params: { extensions: fileExpertAllowedExtensionsLabel },
    },
  );
  assert.equal(
    validateFileExpertSelection({ name: "calibration.BIN", size: 1_024 }),
    null,
  );
  assert.equal(validateFileExpertSelection(null), null);
});

test("the same stored File Expert validation state re-renders in the active locale", () => {
  const tooLarge = validateFileExpertSelection({
    name: "oversize.bin",
    size: fileExpertMaxFileSize + 1,
  });
  assert.ok(tooLarge);

  assert.equal(
    localizeFileExpertValidation("en", tooLarge),
    "The file is too large. Maximum size: 32 MB.",
  );
  assert.equal(
    localizeFileExpertValidation("de", tooLarge),
    "Die Datei ist zu groß. Maximale Größe: 32 MB.",
  );

  const textLimit = getFileExpertTextLimitValidation({
    brand: "BMW",
    model: "M3",
    engine: "S58",
    ecuType: "Bosch MG1",
    customerNotes: "x".repeat(fileExpertTextLimits.customerNotes + 1),
  });
  assert.deepEqual(textLimit, {
    key: "fileExpertTextLimit",
    params: {
      fieldKey: "fileExpertFieldNotes",
      count: fileExpertTextLimits.customerNotes,
    },
  });
  assert.ok(textLimit);
  assert.equal(
    localizeFileExpertValidation("en", textLimit),
    "Customer notes must contain no more than 2,000 characters.",
  );
  assert.equal(
    localizeFileExpertValidation("de", textLimit),
    "Kundennotizen darf höchstens 2.000 Zeichen enthalten.",
  );

  const uploadRequired = fileExpertUploadRequiredValidation();
  assert.equal(
    localizeFileExpertValidation("en", uploadRequired),
    "Upload at least one valid ORI or MOD file.",
  );
  assert.equal(
    localizeFileExpertValidation("tr", uploadRequired),
    "En az bir geçerli ORI veya MOD dosyası yükleyin.",
  );
});

test("File Expert raw server or customer leaves remain opaque while validation stays semantic", () => {
  const rawText = "Untrusted server leaf: <script>{size}</script>";
  assert.equal(
    localizeFileExpertPageMessage("de", { type: "raw", text: rawText }),
    rawText,
  );

  const source = readFileSync(
    "src/app/dashboard/file-expert/page.tsx",
    "utf8",
  );
  assert.match(
    source,
    /Record<\s*FileSlot,\s*FileExpertValidationDescriptor \| null\s*>/u,
  );
  assert.match(source, /setOriFile\(validation \? null : file\)/u);
  assert.match(
    source,
    /setMessage\(\{ type: "validation", descriptor: validation \}\)/u,
  );
  assert.match(
    source,
    /localizeFileExpertPageMessage\(locale, message\)/u,
  );
  assert.doesNotMatch(
    source,
    /setMessage\(customerWorkflowT\(locale, "fileExpertUploadFile"/u,
  );
});
