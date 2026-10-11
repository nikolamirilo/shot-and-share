/**
 * `application/ld+json` is not executed, and React would escape the JSON's quotes. The
 * content is built in lib/seo.ts, never from user input.
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
