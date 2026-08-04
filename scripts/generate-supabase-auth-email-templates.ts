import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildSupabaseAuthTemplateHtml,
  buildSupabaseAuthTemplateSubject,
  supabaseAuthTemplateCatalog,
} from "../src/lib/email/supabaseAuthTemplates";

const outputDirectory = resolve(process.cwd(), "docs", "email-templates");
const legacyFileNames: Record<string, string> = {
  confirm_signup: "confirm-signup.html",
  password_recovery: "reset-password.html",
  password_changed: "password-changed.html",
};

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const manifest = supabaseAuthTemplateCatalog.map((template) => {
    const file = legacyFileNames[template.key] ?? `${template.key.replaceAll("_", "-")}.html`;
    const html = buildSupabaseAuthTemplateHtml(template.key);
    const subject = buildSupabaseAuthTemplateSubject(template.key);
    if (!html || !subject) throw new Error(`Template generation failed: ${template.key}`);
    return { ...template, file, html, subject };
  });

  for (const template of manifest) {
    await writeFile(resolve(outputDirectory, template.file), `${template.html}\n`, "utf8");
  }

  await writeFile(
    resolve(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest.map(({ key, supabaseKey, label, category, file, subject }) => ({
      key,
      supabaseKey,
      label,
      category,
      file,
      subject,
    })), null, 2)}\n`,
    "utf8"
  );

  process.stdout.write(`Generated ${manifest.length} Supabase Auth email templates.\n`);
}

void main();
