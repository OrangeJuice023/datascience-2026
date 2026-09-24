import type { Medicine } from "@/types/access";

/**
 * DEMO medicine list for the ACCESS prototype. Common over-the-counter
 * items chosen only to exercise the interface; listing a medicine here is
 * not a clinical recommendation.
 */
export const DEMO_MEDICINES: Medicine[] = [
  { id: "oral-rehydration-salts", name: "Oral rehydration salts", category: "Rehydration", isSample: true },
  { id: "paracetamol", name: "Paracetamol", category: "Analgesic / antipyretic", isSample: true },
  { id: "antihistamine", name: "Antihistamine (generic)", category: "Allergy", isSample: true },
  { id: "zinc-supplement", name: "Zinc supplement", category: "Supplement", isSample: true },
];
