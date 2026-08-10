/**
 * A block of structured data.
 *
 * `application/ld+json` is not executed, so `dangerouslySetInnerHTML` is the
 * ordinary way to write it - React would otherwise escape the quotes in the
 * JSON and hand a crawler something unparseable. What goes in is always built
 * by `lib/seo.ts` from the product's own constants, never from anything a user
 * typed, which is what keeps that safe.
 */
export function JsonLd({ id, json }: { id: string; json: string }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
