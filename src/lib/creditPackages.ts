export type CreditPackage = {
  id: CreditPackageId;
  name: string;
  credits: number;
  description: string;
  highlight?: boolean;
};

export const creditPackageIds = [
  "credits_10",
  "credits_50",
  "credits_100",
  "credits_250",
  "credits_500",
] as const;

export type CreditPackageId = (typeof creditPackageIds)[number];
export type CreditPackagePriceMap = Record<CreditPackageId, number>;
export type CreditPackagePriceOverrideMap = Record<CreditPackageId, number | null>;

export const MIN_CREDIT_UNIT_PRICE_EURO = 0.01;
export const MAX_CREDIT_PACKAGE_TOTAL_EURO = 2_000_000;
export const MAX_CUSTOM_CREDIT_UNIT_PRICE_EURO = 4_000;

export function minimumCreditPackageTotalEuro(credits: number) {
  return credits * MIN_CREDIT_UNIT_PRICE_EURO;
}

export const creditPackages: CreditPackage[] = [
  {
    id: "credits_10",
    name: "Starter",
    credits: 10,
    description: "10 credits for occasional file-service work.",
  },
  {
    id: "credits_50",
    name: "Workshop",
    credits: 50,
    description: "50 credits for regular file-service work.",
  },
  {
    id: "credits_100",
    name: "Professional",
    credits: 100,
    description: "100 credits for recurring file-service requests.",
    highlight: true,
  },
  {
    id: "credits_250",
    name: "Partner",
    credits: 250,
    description: "250 credits for workshops and service partners.",
  },
  {
    id: "credits_500",
    name: "Enterprise",
    credits: 500,
    description: "500 credits for established high-volume accounts.",
  },
];

export function getCreditPackage(packageId: string) {
  return creditPackages.find((item) => item.id === packageId);
}
