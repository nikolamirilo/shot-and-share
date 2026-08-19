import type { Metadata } from "next";

import { LegalDocument, legalMetadata } from "@/components/legal/legal-document";

export const metadata: Metadata = legalMetadata("privacy");

export default function Page() {
  return <LegalDocument slug="privacy" />;
}
