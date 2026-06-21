export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  basePriceEuro: number;
  priceEuro: number;
  description: string;
  highlight?: boolean;
};

export const CREDIT_PROMOTION_PERCENT = 20;
export const CUSTOM_CREDIT_BASE_PRICE_EURO = 5;
export const CUSTOM_CREDIT_PRICE_EURO = 4;

export const creditPackages: CreditPackage[] = [
  {
    id: "credits_10",
    name: "Starter",
    credits: 10,
    basePriceEuro: 45,
    priceEuro: 36,
    description: "Perfect for testing the platform or a small single request.",
  },
  {
    id: "credits_50",
    name: "Workshop",
    credits: 50,
    basePriceEuro: 225,
    priceEuro: 180,
    description: "Better price for regular customers and workshops.",
  },
  {
    id: "credits_100",
    name: "Professional",
    credits: 100,
    basePriceEuro: 400,
    priceEuro: 320,
    description: "Strong value for recurring file service requests.",
    highlight: true,
  },
  {
    id: "credits_250",
    name: "Partner",
    credits: 250,
    basePriceEuro: 875,
    priceEuro: 700,
    description: "High-volume package for workshops and partners.",
  },
  {
    id: "credits_500",
    name: "Enterprise",
    credits: 500,
    basePriceEuro: 1500,
    priceEuro: 1200,
    description: "Best value package for professional users.",
  },
];

export function getCreditPackage(packageId: string) {
  return creditPackages.find((item) => item.id === packageId);
}
