import { renderRootHomepage } from "@/lib/renderRootHomepage";
import { getServerLocale } from "@/lib/serverLocale";

export default async function HomePage() {
  return renderRootHomepage(await getServerLocale());
}
