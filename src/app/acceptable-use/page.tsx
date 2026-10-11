import type { Metadata } from "next";

import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export const metadata: Metadata = legalMetadata("acceptable-use");

export default function Page() {
  return <LegalDocument slug="acceptable-use" />;
}
