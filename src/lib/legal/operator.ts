export const OPERATOR = {
  legalName: "Reactify Solutions",
  form: "sole proprietorship registered in the Republic of Serbia",
  shortForm: "sole proprietorship, Serbia",
  address: {
    city: "Zemun, Belgrade",
    country: "Serbia",
  },
  // Matični broj, the company registration number.
  registrationNumber: "68333105",
  // PIB, the tax number issued by the Serbian Tax Administration.
  taxNumber: "115395039",
  activity: "6201 - Computer programming",
  registeredOn: "21 November 2025",
} as const;

export const OPERATOR_LINE =
  `Shot & Share is a product of ${OPERATOR.legalName}, a ${OPERATOR.shortForm}.`;

export function addressLine(): string {
  const { city, country } = OPERATOR.address;
  return `${city}, ${country}`;
}

export const TAKEDOWN_RESPONSE_HOURS = 72;
