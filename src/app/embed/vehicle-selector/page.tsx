import { headers } from "next/headers";
import { PublicVehicleSelector } from "@/components/widget/PublicVehicleSelector";
import { widgetT } from "@/lib/i18n/widget-translations";
import { createWidgetSession } from "@/lib/widget/session";
import { validateWidgetClient } from "@/lib/widget/validation";

export const dynamic = "force-dynamic";

function widgetDocumentLanguage(language: string) {
  const direction = language === "ar" ? "rtl" : "ltr";
  const assignment = `document.documentElement.lang=${JSON.stringify(language)};document.documentElement.dir=${JSON.stringify(direction)};`;

  return (
    <script
      data-widget-document-language={language}
      dangerouslySetInnerHTML={{ __html: assignment }}
    />
  );
}

export default async function VehicleSelectorEmbedPage({ searchParams }: { searchParams: Promise<{ key?: string; lang?: string }> }) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const key = params.key ?? "";
  const result = await validateWidgetClient(key, requestHeaders, params.lang, { path: "/embed/vehicle-selector" });

  if (
    !result.valid || !result.client || !result.settings || !result.language ||
    !result.requestDomain || !result.settings.allow_iframe_embed || !result.client.allow_iframe_embed
  ) {
    const language = result.language ?? "en";
    return (
      <>
        {widgetDocumentLanguage(language)}
        <main
          data-widget-embed
          lang={language}
          dir={language === "ar" ? "rtl" : "ltr"}
          className="flex min-h-screen items-center justify-center bg-[#f5f6f8] p-4 text-center text-sm font-semibold text-zinc-700"
        >
          {widgetT(language, "unavailable")}
        </main>
      </>
    );
  }

  const origin = result.requestOrigin || `https://${result.requestDomain}`;
  const sessionToken = createWidgetSession({
    clientId: result.client.id,
    publicKey: key,
    domain: result.requestDomain,
    origin,
    language: result.language,
  });
  const apiBaseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/$/, "");

  return (
    <>
      {widgetDocumentLanguage(result.language)}
      <main
        data-widget-embed
        lang={result.language}
        dir={result.language === "ar" ? "rtl" : "ltr"}
        className="min-h-screen bg-transparent p-2 sm:p-4"
      >
        <PublicVehicleSelector
          publicKey={key}
          sessionToken={sessionToken}
          apiBaseUrl={apiBaseUrl}
          targetOrigin={origin}
          config={{
            widget_title: result.client.widget_title,
            button_text: result.client.button_text,
            main_color: result.client.main_color,
            button_text_color: result.client.button_text_color,
            difference_color: result.client.difference_color,
            theme_mode: result.client.theme_mode,
            show_branding: result.settings.show_mg_branding && result.client.show_branding,
            language: result.language,
          }}
        />
      </main>
    </>
  );
}

