import type { Metadata } from "next";

import { LegalDocument, legalMetadata } from "@/components/legal/legal-document";

export const metadata: Metadata = legalMetadata("refund-policy");

export default function Page() {
  return <LegalDocument slug="refund-policy" />;
}
