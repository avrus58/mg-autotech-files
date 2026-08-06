import {
  defaultLocale,
  normalizeLocale,
  type LocaleCode,
} from "@/lib/i18nConfig";

export type AnalyticsConsentCopy = {
  title: string;
  description: string;
  acceptAll: string;
  analyticsOnly: string;
  necessaryOnly: string;
  customize: string;
  savePreferences: string;
  analyticsLabel: string;
  analyticsDescription: string;
  advertisingLabel: string;
  advertisingDescription: string;
  personalizationDisabled: string;
  privacyInformation: string;
  openPreferences: string;
  preferencesTitle: string;
  enabledAnnouncement: string;
  disabledAnnouncement: string;
};

export const analyticsConsentCopy: Record<LocaleCode, AnalyticsConsentCopy> = {
  en: {
    title: "Privacy choices",
    description:
      "Optional measurement helps MG AutoTech improve public pages and understand which campaigns lead to verified results. File names, vehicle details, account data and order IDs are never included.",
    acceptAll: "Accept all",
    analyticsOnly: "Analytics only",
    necessaryOnly: "Necessary only",
    customize: "Customize",
    savePreferences: "Save preferences",
    analyticsLabel: "Analytics",
    analyticsDescription: "Measures public page use and the secure request funnel.",
    advertisingLabel: "Advertising measurement",
    advertisingDescription: "Measures whether an ad leads to a verified registration, request or payment.",
    personalizationDisabled: "Personalized advertising remains disabled.",
    privacyInformation: "Privacy information",
    openPreferences: "Open privacy preferences",
    preferencesTitle: "Privacy preferences",
    enabledAnnouncement: "Optional measurement preferences saved.",
    disabledAnnouncement: "Optional measurement disabled.",
  },
  de: {
    title: "Datenschutzauswahl",
    description:
      "Optionale Messungen helfen MG AutoTech, öffentliche Seiten zu verbessern und zu verstehen, welche Kampagnen zu bestätigten Ergebnissen führen. Dateinamen, Fahrzeugdaten, Kontodaten und Auftragsnummern werden niemals übermittelt.",
    acceptAll: "Alle akzeptieren",
    analyticsOnly: "Nur Analyse",
    necessaryOnly: "Nur erforderlich",
    customize: "Anpassen",
    savePreferences: "Auswahl speichern",
    analyticsLabel: "Analyse",
    analyticsDescription: "Misst die Nutzung öffentlicher Seiten und den sicheren Anfrageablauf.",
    advertisingLabel: "Werbemessung",
    advertisingDescription: "Misst, ob eine Anzeige zu Registrierung, Anfrage oder bestätigter Zahlung führt.",
    personalizationDisabled: "Personalisierte Werbung bleibt deaktiviert.",
    privacyInformation: "Datenschutzinformationen",
    openPreferences: "Datenschutzeinstellungen öffnen",
    preferencesTitle: "Datenschutzeinstellungen",
    enabledAnnouncement: "Optionale Messeinstellungen gespeichert.",
    disabledAnnouncement: "Optionale Messung deaktiviert.",
  },
  tr: {
    title: "Gizlilik tercihleri",
    description:
      "İsteğe bağlı ölçüm, MG AutoTech'in herkese açık sayfaları iyileştirmesine ve hangi kampanyaların doğrulanmış sonuçlara ulaştığını anlamasına yardımcı olur. Dosya adları, araç bilgileri, hesap verileri ve sipariş numaraları hiçbir zaman gönderilmez.",
    acceptAll: "Tümünü kabul et",
    analyticsOnly: "Yalnızca analiz",
    necessaryOnly: "Yalnızca gerekli",
    customize: "Özelleştir",
    savePreferences: "Tercihleri kaydet",
    analyticsLabel: "Analiz",
    analyticsDescription: "Herkese açık sayfa kullanımını ve güvenli talep akışını ölçer.",
    advertisingLabel: "Reklam ölçümü",
    advertisingDescription: "Bir reklamın doğrulanmış kayıt, talep veya ödemeye dönüşüp dönüşmediğini ölçer.",
    personalizationDisabled: "Kişiselleştirilmiş reklamlar kapalı kalır.",
    privacyInformation: "Gizlilik bilgileri",
    openPreferences: "Gizlilik tercihlerini aç",
    preferencesTitle: "Gizlilik tercihleri",
    enabledAnnouncement: "İsteğe bağlı ölçüm tercihleri kaydedildi.",
    disabledAnnouncement: "İsteğe bağlı ölçüm devre dışı bırakıldı.",
  },
  fr: {
    title: "Choix de confidentialité",
    description:
      "Les mesures facultatives aident MG AutoTech à améliorer les pages publiques et à comprendre quelles campagnes produisent des résultats vérifiés. Les noms de fichiers, données du véhicule, données du compte et numéros de commande ne sont jamais transmis.",
    acceptAll: "Tout accepter",
    analyticsOnly: "Analyses uniquement",
    necessaryOnly: "Nécessaires uniquement",
    customize: "Personnaliser",
    savePreferences: "Enregistrer les choix",
    analyticsLabel: "Analyses",
    analyticsDescription: "Mesure l'utilisation des pages publiques et le parcours sécurisé de demande.",
    advertisingLabel: "Mesure publicitaire",
    advertisingDescription: "Mesure si une annonce mène à une inscription, demande ou paiement vérifié.",
    personalizationDisabled: "La publicité personnalisée reste désactivée.",
    privacyInformation: "Informations de confidentialité",
    openPreferences: "Ouvrir les choix de confidentialité",
    preferencesTitle: "Choix de confidentialité",
    enabledAnnouncement: "Préférences de mesure enregistrées.",
    disabledAnnouncement: "Mesure facultative désactivée.",
  },
  nl: {
    title: "Privacykeuzes",
    description:
      "Optionele meting helpt MG AutoTech openbare pagina's te verbeteren en te begrijpen welke campagnes tot geverifieerde resultaten leiden. Bestandsnamen, voertuiggegevens, accountgegevens en ordernummers worden nooit verzonden.",
    acceptAll: "Alles accepteren",
    analyticsOnly: "Alleen analyse",
    necessaryOnly: "Alleen noodzakelijk",
    customize: "Aanpassen",
    savePreferences: "Voorkeuren opslaan",
    analyticsLabel: "Analyse",
    analyticsDescription: "Meet openbaar paginagebruik en het beveiligde aanvraagproces.",
    advertisingLabel: "Advertentiemeting",
    advertisingDescription: "Meet of een advertentie leidt tot een geverifieerde registratie, aanvraag of betaling.",
    personalizationDisabled: "Gepersonaliseerde advertenties blijven uitgeschakeld.",
    privacyInformation: "Privacy-informatie",
    openPreferences: "Privacyvoorkeuren openen",
    preferencesTitle: "Privacyvoorkeuren",
    enabledAnnouncement: "Meetvoorkeuren opgeslagen.",
    disabledAnnouncement: "Optionele meting uitgeschakeld.",
  },
  it: {
    title: "Scelte sulla privacy",
    description:
      "La misurazione facoltativa aiuta MG AutoTech a migliorare le pagine pubbliche e a capire quali campagne generano risultati verificati. Nomi dei file, dati del veicolo, dati dell'account e numeri d'ordine non vengono mai trasmessi.",
    acceptAll: "Accetta tutto",
    analyticsOnly: "Solo analisi",
    necessaryOnly: "Solo necessari",
    customize: "Personalizza",
    savePreferences: "Salva preferenze",
    analyticsLabel: "Analisi",
    analyticsDescription: "Misura l'uso delle pagine pubbliche e il flusso sicuro delle richieste.",
    advertisingLabel: "Misurazione pubblicitaria",
    advertisingDescription: "Misura se un annuncio porta a registrazione, richiesta o pagamento verificato.",
    personalizationDisabled: "La pubblicità personalizzata resta disattivata.",
    privacyInformation: "Informazioni sulla privacy",
    openPreferences: "Apri preferenze privacy",
    preferencesTitle: "Preferenze privacy",
    enabledAnnouncement: "Preferenze di misurazione salvate.",
    disabledAnnouncement: "Misurazione facoltativa disattivata.",
  },
  es: {
    title: "Opciones de privacidad",
    description:
      "La medición opcional ayuda a MG AutoTech a mejorar las páginas públicas y a saber qué campañas producen resultados verificados. Nunca se transmiten nombres de archivo, datos del vehículo, datos de la cuenta ni números de pedido.",
    acceptAll: "Aceptar todo",
    analyticsOnly: "Solo analítica",
    necessaryOnly: "Solo necesarios",
    customize: "Personalizar",
    savePreferences: "Guardar preferencias",
    analyticsLabel: "Analítica",
    analyticsDescription: "Mide el uso de páginas públicas y el flujo seguro de solicitudes.",
    advertisingLabel: "Medición publicitaria",
    advertisingDescription: "Mide si un anuncio genera un registro, solicitud o pago verificado.",
    personalizationDisabled: "La publicidad personalizada permanece desactivada.",
    privacyInformation: "Información de privacidad",
    openPreferences: "Abrir preferencias de privacidad",
    preferencesTitle: "Preferencias de privacidad",
    enabledAnnouncement: "Preferencias de medición guardadas.",
    disabledAnnouncement: "Medición opcional desactivada.",
  },
  pt: {
    title: "Opções de privacidade",
    description:
      "A medição opcional ajuda a MG AutoTech a melhorar as páginas públicas e a compreender quais campanhas geram resultados verificados. Nomes de ficheiros, dados do veículo, dados da conta e números de pedido nunca são enviados.",
    acceptAll: "Aceitar tudo",
    analyticsOnly: "Apenas análise",
    necessaryOnly: "Apenas necessários",
    customize: "Personalizar",
    savePreferences: "Guardar preferências",
    analyticsLabel: "Análise",
    analyticsDescription: "Mede a utilização das páginas públicas e o fluxo seguro de pedidos.",
    advertisingLabel: "Medição publicitária",
    advertisingDescription: "Mede se um anúncio conduz a registo, pedido ou pagamento verificado.",
    personalizationDisabled: "A publicidade personalizada permanece desativada.",
    privacyInformation: "Informações de privacidade",
    openPreferences: "Abrir preferências de privacidade",
    preferencesTitle: "Preferências de privacidade",
    enabledAnnouncement: "Preferências de medição guardadas.",
    disabledAnnouncement: "Medição opcional desativada.",
  },
  pl: {
    title: "Ustawienia prywatności",
    description:
      "Opcjonalne pomiary pomagają MG AutoTech ulepszać strony publiczne i rozumieć, które kampanie prowadzą do zweryfikowanych wyników. Nazwy plików, dane pojazdu, dane konta i numery zamówień nigdy nie są przesyłane.",
    acceptAll: "Akceptuj wszystko",
    analyticsOnly: "Tylko analityka",
    necessaryOnly: "Tylko niezbędne",
    customize: "Dostosuj",
    savePreferences: "Zapisz ustawienia",
    analyticsLabel: "Analityka",
    analyticsDescription: "Mierzy korzystanie ze stron publicznych i bezpieczny proces zlecenia.",
    advertisingLabel: "Pomiar reklam",
    advertisingDescription: "Mierzy, czy reklama prowadzi do zweryfikowanej rejestracji, zlecenia lub płatności.",
    personalizationDisabled: "Reklamy spersonalizowane pozostają wyłączone.",
    privacyInformation: "Informacje o prywatności",
    openPreferences: "Otwórz ustawienia prywatności",
    preferencesTitle: "Ustawienia prywatności",
    enabledAnnouncement: "Ustawienia pomiaru zapisane.",
    disabledAnnouncement: "Opcjonalny pomiar wyłączony.",
  },
  ru: {
    title: "Настройки конфиденциальности",
    description:
      "Необязательные измерения помогают MG AutoTech улучшать общедоступные страницы и понимать, какие кампании приводят к подтвержденным результатам. Имена файлов, данные автомобиля, аккаунта и номера заказов никогда не передаются.",
    acceptAll: "Принять все",
    analyticsOnly: "Только аналитика",
    necessaryOnly: "Только необходимые",
    customize: "Настроить",
    savePreferences: "Сохранить настройки",
    analyticsLabel: "Аналитика",
    analyticsDescription: "Измеряет использование общедоступных страниц и безопасный процесс заявки.",
    advertisingLabel: "Измерение рекламы",
    advertisingDescription: "Измеряет, приводит ли реклама к подтвержденной регистрации, заявке или оплате.",
    personalizationDisabled: "Персонализированная реклама остается отключенной.",
    privacyInformation: "Информация о конфиденциальности",
    openPreferences: "Открыть настройки конфиденциальности",
    preferencesTitle: "Настройки конфиденциальности",
    enabledAnnouncement: "Настройки измерения сохранены.",
    disabledAnnouncement: "Необязательное измерение отключено.",
  },
  zh: {
    title: "隐私选项",
    description:
      "可选衡量功能帮助 MG AutoTech 改进公开页面，并了解哪些广告活动带来已验证结果。文件名、车辆详情、账户数据和订单号绝不会被发送。",
    acceptAll: "全部接受",
    analyticsOnly: "仅分析",
    necessaryOnly: "仅必要功能",
    customize: "自定义",
    savePreferences: "保存偏好",
    analyticsLabel: "分析",
    analyticsDescription: "衡量公开页面使用情况和安全请求流程。",
    advertisingLabel: "广告衡量",
    advertisingDescription: "衡量广告是否带来已验证的注册、请求或付款。",
    personalizationDisabled: "个性化广告保持关闭。",
    privacyInformation: "隐私信息",
    openPreferences: "打开隐私偏好",
    preferencesTitle: "隐私偏好",
    enabledAnnouncement: "衡量偏好已保存。",
    disabledAnnouncement: "可选衡量已关闭。",
  },
  sq: {
    title: "Zgjedhjet e privatësisë",
    description:
      "Matja opsionale ndihmon MG AutoTech të përmirësojë faqet publike dhe të kuptojë cilat fushata sjellin rezultate të verifikuara. Emrat e skedarëve, të dhënat e automjetit, të llogarisë dhe numrat e porosive nuk dërgohen kurrë.",
    acceptAll: "Prano të gjitha",
    analyticsOnly: "Vetëm analiza",
    necessaryOnly: "Vetëm të nevojshmet",
    customize: "Personalizo",
    savePreferences: "Ruaj preferencat",
    analyticsLabel: "Analiza",
    analyticsDescription: "Mat përdorimin e faqeve publike dhe rrjedhën e sigurt të kërkesës.",
    advertisingLabel: "Matja e reklamave",
    advertisingDescription: "Mat nëse një reklamë sjell regjistrim, kërkesë ose pagesë të verifikuar.",
    personalizationDisabled: "Reklamat e personalizuara mbeten të çaktivizuara.",
    privacyInformation: "Informacion mbi privatësinë",
    openPreferences: "Hap preferencat e privatësisë",
    preferencesTitle: "Preferencat e privatësisë",
    enabledAnnouncement: "Preferencat e matjes u ruajtën.",
    disabledAnnouncement: "Matja opsionale u çaktivizua.",
  },
};

export function getAnalyticsConsentLocale(pathname: string): LocaleCode {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment ? normalizeLocale(firstSegment) : defaultLocale;
}

export function getAnalyticsConsentCopy(pathname: string) {
  return analyticsConsentCopy[getAnalyticsConsentLocale(pathname)];
}
