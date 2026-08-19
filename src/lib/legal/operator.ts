/**
 * Who is actually selling this.
 *
 * A payment provider taking on merchant-of-record liability looks for the
 * trading entity before it looks at anything else, and finding a product with
 * no operator named is what makes a store read as a side project. So the entity
 * lives in one file, is imported by every page that has to name it, and is
 * never retyped into prose.
 *
 * The registry holds these in Cyrillic. They are written here in Latin because
 * the pages around them are in English, and both scripts are official in
 * Serbia, so neither is a translation of the other.
 */

export const OPERATOR = {
  /** The short business name as registered. */
  legalName: "Nikola Mirilo preduzetnik Reactify Solutions",
  /** What the entity is, in words a reader outside Serbia will recognise. */
  form: "sole proprietorship registered in the Republic of Serbia",
  /** Shorter, for a footer line where the full sentence will not fit. */
  shortForm: "sole proprietorship, Serbia",
  address: {
    street: "Užička 7b, sprat 3, stan 7",
    city: "Zemun, Belgrade",
    /** As it appears on the registration: the delivery post office. */
    postOffice: "82 Beograd 82",
    country: "Serbia",
  },
  /** Matični broj, the company registration number. */
  registrationNumber: "68333105",
  /** PIB, the tax number issued by the Serbian Tax Administration. */
  taxNumber: "115395039",
  /** Registered activity 6201, computer programming. */
  activity: "6201 - Computer programming",
  /** Trading since. */
  registeredOn: "21 November 2025",
} as const;

/**
 * The product is the selling identity and the entity is behind it. Both have to
 * appear together, because a reviewer comparing the store name against the KYB
 * paperwork needs the sentence that joins them.
 */
export const OPERATOR_LINE =
  `Shot & Share is a product of ${OPERATOR.legalName}, a ${OPERATOR.shortForm}.`;

/** The postal address on one line, for a footer or a contact block. */
export function addressLine(): string {
  const { street, city, country } = OPERATOR.address;
  return `${street}, ${city}, ${country}`;
}

/**
 * How long a takedown or erasure request waits before it is answered. Stated on
 * the acceptable use and privacy pages, so it is a promise, and it is kept here
 * so both pages promise the same number.
 */
export const TAKEDOWN_RESPONSE_HOURS = 72;
