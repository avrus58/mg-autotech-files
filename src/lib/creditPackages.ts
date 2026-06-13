export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceEuro: number;
  description: string;
  highlight?: boolean;
};

export const creditPackages: CreditPackage[] = [
  {
    id: "credits_10",
    name: "Starter",
    credits: 10,
    priceEuro: 50,
    description: "Perfect for testing the platform or a small single request.",
  },
  {
    id: "credits_50",
    name: "Workshop",
    credits: 50,
    priceEuro: 225,
    description: "Better price for regular customers and workshops.",
  },
  {
    id: "credits_100",
    name: "Professional",
    credits: 100,
    priceEuro: 400,
    description: "Strong value for recurring file service requests.",
    highlight: true,
  },
  {
    id: "credits_250",
    name: "Partner",
    credits: 250,
    priceEuro: 875,
    description: "High-volume package for workshops and partners.",
  },
  {
    id: "credits_500",
    name: "Enterprise",
    credits: 500,
    priceEuro: 1500,
    description: "Best value package for professional users.",
  },
];

export function getCreditPackage(packageId: string) {
  return creditPackages.find((item) => item.id === packageId);
}