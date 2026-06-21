import {
  CUSTOM_CREDIT_PRICE_EURO,
  getCreditPackage,
} from "@/lib/creditPackages";

export type SelectedCreditPurchase = {
  id: string;
  credits: number;
  priceEuro: number;
  description: string;
  purchaseType: "package" | "custom";
};

export function getSelectedCreditPurchase(body: {
  packageId?: unknown;
  customCredits?: unknown;
}): SelectedCreditPurchase | null {
  const packageId = body.packageId;
  const customCredits = Number(body.customCredits ?? 0);

  if (packageId && typeof packageId === "string") {
    const packageData = getCreditPackage(packageId);

    if (!packageData) return null;

    return {
      id: packageData.id,
      credits: packageData.credits,
      priceEuro: packageData.priceEuro,
      description: packageData.description,
      purchaseType: "package",
    };
  }

  if (
    Number.isFinite(customCredits) &&
    Number.isInteger(customCredits) &&
    customCredits >= 1 &&
    customCredits <= 1000
  ) {
    return {
      id: `custom_${customCredits}`,
      credits: customCredits,
      priceEuro: customCredits * CUSTOM_CREDIT_PRICE_EURO,
      description: `Custom credit purchase: ${customCredits} credits at €${CUSTOM_CREDIT_PRICE_EURO} per credit.`,
      purchaseType: "custom",
    };
  }

  return null;
}
