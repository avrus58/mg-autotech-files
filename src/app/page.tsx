import { HomepageExperience } from "@/components/homepage/HomepageExperience";
import { buildPublicLogSnapshotCopy } from "@/lib/i18n/tool-client-copy";
import { getServerLocale } from "@/lib/serverLocale";

export default async function HomePage() {
  const locale = await getServerLocale();
  return (
    <HomepageExperience
      locale={locale}
      publicLogSnapshotCopy={buildPublicLogSnapshotCopy(locale)}
    />
  );
}
