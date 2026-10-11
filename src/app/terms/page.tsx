import type { Metadata } from "next";

import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export const metadata: Metadata = legalMetadata("terms");

export default function Page() {
  return <LegalDocument slug="terms" />;
}
