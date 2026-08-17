/**
 * Key layout and file-type rules. Safe to import from a client component.
 *
 * `delete.ts` and `view.ts` are deliberately not re-exported here: both are
 * server-only, and a barrel that dragged them in would break every client
 * component that only wanted an accept attribute.
 */
export * from "@/lib/media/keys";
export * from "@/lib/media/accept";
export * from "@/lib/media/wording";
