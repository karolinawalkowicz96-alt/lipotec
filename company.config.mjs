/**
 * LIPOTEC — central company configuration.
 *
 * This is the ONLY place where company and contact data live. Every page,
 * the footer, structured data, the privacy policy and the contact API read
 * from here. Fill in the empty strings when the data is confirmed and run
 * `npm run build` (Vercel does this automatically on deploy).
 *
 * Empty values are hidden on the public site — no placeholders are shown.
 */
export const company = {
  brand: "LIPOTEC",
  siteUrl: "https://lipotec.vercel.app",

  // Contact
  email: "lipotec@gmail.com",
  phone: "", // e.g. "+48 600 000 000" — shown only when filled in

  // Legal / registration data — TO BE COMPLETED before the site is
  // considered formally compliant (imprint, privacy policy, RODO art. 13).
  legalName: "", // full legal name of the business
  legalForm: "", // e.g. "spółka z o.o.", "jednoosobowa działalność gospodarcza"
  address: "", // registered office
  correspondenceAddress: "",
  nip: "",
  regon: "",
  krs: "", // only if applicable
  dataController: "", // RODO data controller, if different from legalName

  // Set to true only once all legally required data above is filled in.
  complianceReady: false,
};

/** Fields that must be completed before the site is formally compliant. */
export const requiredBeforeCompliance = [
  "legalName",
  "legalForm",
  "address",
  "nip",
  "regon",
];

export default company;
