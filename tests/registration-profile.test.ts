import assert from "node:assert/strict";
import test from "node:test";
import {
  createRegistrationProfileDraft,
  parseRegistrationProfileDraft,
} from "../src/lib/registrationProfile";

test("company registration profile keeps explicit company identity", () => {
  assert.deepEqual(
    createRegistrationProfileDraft({
      fullName: "Workshop Owner",
      accountType: "company",
      companyName: "Example Workshop GmbH",
      phone: "+49 151 1234567",
      taxNumber: "DE123456789",
      emailLanguage: "de",
    }),
    {
      full_name: "Workshop Owner",
      account_type: "company",
      company_name: "Example Workshop GmbH",
      phone: "+49 151 1234567",
      vat_id: "DE123456789",
      tax_number: "DE123456789",
      email_language: "de",
    }
  );
});

test("private registration cannot retain stale company or VAT values", () => {
  const draft = createRegistrationProfileDraft({
    fullName: "Private Customer",
    accountType: "private",
    companyName: "Stale Company",
    phone: "",
    taxNumber: "STALE-VAT",
    emailLanguage: "en",
  });

  assert.equal(draft?.company_name, null);
  assert.equal(draft?.vat_id, null);
  assert.equal(draft?.tax_number, null);
});

test("registration profile preserves every reviewed email locale and rejects unknown values", () => {
  const french = createRegistrationProfileDraft({
    fullName: "Client Atelier",
    accountType: "company",
    companyName: "Atelier Exemple",
    phone: "+33 1 23 45 67 89",
    taxNumber: "FR123456789",
    emailLanguage: "fr",
  });

  assert.equal(french?.email_language, "fr");
  assert.equal(
    parseRegistrationProfileDraft(JSON.stringify({
      ...french,
      email_language: "unsupported",
    })),
    null
  );
});

test("registration profile parser rejects incomplete or oversized drafts", () => {
  assert.equal(parseRegistrationProfileDraft(null), null);
  assert.equal(parseRegistrationProfileDraft("not-json"), null);
  assert.equal(
    parseRegistrationProfileDraft(JSON.stringify({
      full_name: "Workshop Owner",
      account_type: "company",
      company_name: "",
      phone: null,
      vat_id: null,
      tax_number: null,
      email_language: "en",
    })),
    null
  );
  assert.equal(
    parseRegistrationProfileDraft(JSON.stringify({
      full_name: "A".repeat(121),
      account_type: "private",
      company_name: null,
      phone: null,
      vat_id: null,
      tax_number: null,
      email_language: "en",
    })),
    null
  );
});
