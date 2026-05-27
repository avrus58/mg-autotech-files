export type CreditPackage = {
  id: "starter" | "workshop" | "professional" | "partner";
  name: string;
  credits: number;
  priceEuro: number;
  description: string;
  highlight?: boolean;
};

export const creditPackages: CreditPackage[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 25,
    priceEuro: 49,
    description: "For single ECU/TCU file requests and first platform usage.",
  },
  {
    id: "workshop",
    name: "Workshop",
    credits: 50,
    priceEuro: 89,
    description: "For workshops with regular customer file requests.",
    highlight: true,
  },
  {
    id: "professional",
    name: "Professional",
    credits: 100,
    priceEuro: 169,
    description: "For active tuning work and recurring file service orders.",
  },
  {
    id: "partner",
    name: "Partner",
    credits: 250,
    priceEuro: 399,
    description: "For high-volume partners and professional service providers.",
  },
];

export function getCreditPackage(packageId: string) {
  return creditPackages.find((item) => item.id === packageId);
}
