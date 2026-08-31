"use client";

import { useSyncExternalStore } from "react";
import {
  resolveSupportedLocaleCandidates,
  supportedLocales,
  type LocaleCode,
} from "@/lib/i18nConfig";
import { readLocaleCookie, readStoredLocale } from "@/lib/localePreference";

type RecoveryCopy = {
  eyebrow: string;
  title: string;
  description: string;
  retry: string;
  notFoundEyebrow: string;
  notFoundTitle: string;
  notFoundDescription: string;
  home: string;
  services: string;
};

export const recoveryTranslations: Record<LocaleCode, RecoveryCopy> = {
  en: {
    eyebrow: "MG AutoTech recovery",
    title: "This view needs a clean reload",
    description: "No customer file or request was changed. Please retry the view.",
    retry: "Retry view",
    notFoundEyebrow: "Page not found",
    notFoundTitle: "This page is not available",
    notFoundDescription: "The address may be incorrect or the page may have moved. No customer file or request was changed.",
    home: "Go to homepage",
    services: "Browse services",
  },
  de: {
    eyebrow: "MG AutoTech Wiederherstellung",
    title: "Diese Ansicht muss neu geladen werden",
    description: "Es wurde keine Kundendatei und keine Anfrage geändert. Bitte laden Sie die Ansicht erneut.",
    retry: "Ansicht erneut laden",
    notFoundEyebrow: "Seite nicht gefunden",
    notFoundTitle: "Diese Seite ist nicht verfügbar",
    notFoundDescription: "Die Adresse ist möglicherweise falsch oder die Seite wurde verschoben. Es wurde keine Kundendatei und keine Anfrage geändert.",
    home: "Zur Startseite",
    services: "Services ansehen",
  },
  tr: {
    eyebrow: "MG AutoTech kurtarma",
    title: "Bu görünümün yeniden yüklenmesi gerekiyor",
    description: "Hiçbir müşteri dosyası veya talep değiştirilmedi. Lütfen görünümü yeniden yüklemeyi deneyin.",
    retry: "Görünümü yeniden yükle",
    notFoundEyebrow: "Sayfa bulunamadı",
    notFoundTitle: "Bu sayfa kullanılamıyor",
    notFoundDescription: "Adres hatalı olabilir veya sayfa taşınmış olabilir. Hiçbir müşteri dosyası ya da talep değiştirilmedi.",
    home: "Ana sayfaya git",
    services: "Hizmetleri incele",
  },
  nl: {
    eyebrow: "MG AutoTech-herstel",
    title: "Deze weergave moet opnieuw worden geladen",
    description: "Er is geen klantbestand of aanvraag gewijzigd. Probeer de weergave opnieuw.",
    retry: "Weergave opnieuw proberen",
    notFoundEyebrow: "Pagina niet gevonden",
    notFoundTitle: "Deze pagina is niet beschikbaar",
    notFoundDescription: "Het adres is mogelijk onjuist of de pagina is verplaatst. Er is geen klantbestand of aanvraag gewijzigd.",
    home: "Naar de homepage",
    services: "Diensten bekijken",
  },
  fr: {
    eyebrow: "Récupération MG AutoTech",
    title: "Cette vue doit être rechargée",
    description: "Aucun fichier client ni aucune demande n’ont été modifiés. Réessayez d’afficher cette vue.",
    retry: "Réessayer la vue",
    notFoundEyebrow: "Page introuvable",
    notFoundTitle: "Cette page n’est pas disponible",
    notFoundDescription: "L’adresse est peut-être incorrecte ou la page a été déplacée. Aucun fichier client ni aucune demande n’ont été modifiés.",
    home: "Aller à l’accueil",
    services: "Voir les services",
  },
  it: {
    eyebrow: "Ripristino MG AutoTech",
    title: "Questa vista deve essere ricaricata",
    description: "Nessun file cliente né alcuna richiesta sono stati modificati. Riprova a caricare la vista.",
    retry: "Riprova la vista",
    notFoundEyebrow: "Pagina non trovata",
    notFoundTitle: "Questa pagina non è disponibile",
    notFoundDescription: "L’indirizzo potrebbe essere errato o la pagina potrebbe essere stata spostata. Nessun file cliente né alcuna richiesta sono stati modificati.",
    home: "Vai alla pagina iniziale",
    services: "Sfoglia i servizi",
  },
  ru: {
    eyebrow: "Восстановление MG AutoTech",
    title: "Это представление необходимо перезагрузить",
    description: "Файлы клиентов и запросы не были изменены. Повторите загрузку представления.",
    retry: "Повторить загрузку",
    notFoundEyebrow: "Страница не найдена",
    notFoundTitle: "Эта страница недоступна",
    notFoundDescription: "Возможно, адрес указан неверно или страница была перемещена. Файлы клиентов и запросы не были изменены.",
    home: "На главную",
    services: "Посмотреть услуги",
  },
  es: {
    eyebrow: "Recuperación de MG AutoTech",
    title: "Esta vista debe volver a cargarse",
    description: "No se ha modificado ningún archivo ni solicitud del cliente. Vuelva a intentar cargar la vista.",
    retry: "Reintentar vista",
    notFoundEyebrow: "Página no encontrada",
    notFoundTitle: "Esta página no está disponible",
    notFoundDescription: "Es posible que la dirección sea incorrecta o que la página se haya movido. No se ha modificado ningún archivo ni solicitud del cliente.",
    home: "Ir a la página de inicio",
    services: "Ver servicios",
  },
  pt: {
    eyebrow: "Recuperação da MG AutoTech",
    title: "Esta vista precisa de ser recarregada",
    description: "Nenhum ficheiro ou pedido de cliente foi alterado. Tente carregar a vista novamente.",
    retry: "Tentar novamente",
    notFoundEyebrow: "Página não encontrada",
    notFoundTitle: "Esta página não está disponível",
    notFoundDescription: "O endereço pode estar incorreto ou a página pode ter sido movida. Nenhum ficheiro ou pedido de cliente foi alterado.",
    home: "Ir para a página inicial",
    services: "Ver serviços",
  },
  zh: {
    eyebrow: "MG AutoTech 恢复",
    title: "此视图需要重新加载",
    description: "客户文件和请求均未更改。请重新加载此视图。",
    retry: "重新加载视图",
    notFoundEyebrow: "未找到页面",
    notFoundTitle: "此页面不可用",
    notFoundDescription: "地址可能不正确，或页面已被移动。客户文件和请求均未更改。",
    home: "前往首页",
    services: "浏览服务",
  },
  pl: {
    eyebrow: "Odzyskiwanie MG AutoTech",
    title: "Ten widok wymaga ponownego wczytania",
    description: "Żaden plik klienta ani żadne zlecenie nie zostało zmienione. Spróbuj ponownie wczytać widok.",
    retry: "Wczytaj widok ponownie",
    notFoundEyebrow: "Nie znaleziono strony",
    notFoundTitle: "Ta strona jest niedostępna",
    notFoundDescription: "Adres może być nieprawidłowy lub strona została przeniesiona. Żaden plik klienta ani żadne zlecenie nie zostało zmienione.",
    home: "Przejdź do strony głównej",
    services: "Zobacz usługi",
  },
  sq: {
    eyebrow: "Rikuperimi i MG AutoTech",
    title: "Kjo pamje duhet të ringarkohet",
    description: "Asnjë skedar ose kërkesë klienti nuk u ndryshua. Provoni ta ngarkoni përsëri pamjen.",
    retry: "Provo përsëri pamjen",
    notFoundEyebrow: "Faqja nuk u gjet",
    notFoundTitle: "Kjo faqe nuk është e disponueshme",
    notFoundDescription: "Adresa mund të jetë e pasaktë ose faqja mund të jetë zhvendosur. Asnjë skedar apo kërkesë klienti nuk u ndryshua.",
    home: "Shko te faqja kryesore",
    services: "Shiko shërbimet",
  },
};

const localeCodes = new Set<string>(supportedLocales.map(({ code }) => code));

export function resolveRecoveryLocale({
  pathLocale,
  storedLocale,
  cookieLocale,
  documentLocale,
  browserLocale,
}: {
  pathLocale?: string | null;
  storedLocale?: string | null;
  cookieLocale?: string | null;
  documentLocale?: string | null;
  browserLocale?: string | null;
}): LocaleCode {
  return resolveSupportedLocaleCandidates(
    pathLocale && localeCodes.has(pathLocale) ? pathLocale : null,
    storedLocale,
    cookieLocale,
    documentLocale,
    browserLocale,
  );
}

function readRecoveryLocale(): LocaleCode {
  let pathLocale = "";
  let documentLocale = "";
  let browserLocale = "";
  try {
    pathLocale = window.location.pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {}
  try {
    documentLocale = document.documentElement.lang;
  } catch {}
  try {
    browserLocale = navigator.language;
  } catch {}

  return resolveRecoveryLocale({
    pathLocale,
    storedLocale: readStoredLocale(),
    cookieLocale: readLocaleCookie(),
    documentLocale,
    browserLocale,
  });
}

function subscribeRecoveryLocale(onStoreChange: () => void) {
  try {
    window.addEventListener("mg-locale-change", onStoreChange);
    window.addEventListener("storage", onStoreChange);
    window.addEventListener("popstate", onStoreChange);
    return () => {
      window.removeEventListener("mg-locale-change", onStoreChange);
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener("popstate", onStoreChange);
    };
  } catch {
    return () => undefined;
  }
}

export function useRecoveryLocale() {
  return useSyncExternalStore<LocaleCode | null>(
    subscribeRecoveryLocale,
    readRecoveryLocale,
    // Root error/not-found boundaries sit outside request-localized providers.
    // A neutral server snapshot prevents an incorrect English recovery flash;
    // hydration then resolves path, stored, cookie, document and browser locale.
    () => null,
  );
}
