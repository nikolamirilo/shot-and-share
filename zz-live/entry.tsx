import { createRoot } from "react-dom/client";
import { AppearanceForm } from "@/app/dashboard/events/[id]/appearance-form";
import type { EventRow } from "@/lib/db/types";

const event = {
  id: "e1", owner_id: "o1", name: "Ana and Marko", event_date: "2026-09-12",
  tier: "wedding", keep_forever: false, storage_quota_bytes: 1, storage_used_bytes: 0,
  expires_at: null, status: "active", gallery_visible: true, gallery_layout: "grid",
  theme: "cheese", theme_custom: {}, theme_font: "cheese", cover_variant: "classic",
  upload_variant: "button", welcome_message: "Send us the ones you took.",
  cover_media_id: null, link_opens: 0, archive_key: null, archive_built_at: null,
  archive_size_bytes: null, archive_builds: 0, warned_at_days: null,
  deleted_at: null, created_at: "2026-01-01",
} as EventRow;

createRoot(document.getElementById("root")!).render(
  <AppearanceForm event={event} media={[]} locked={false} />,
);
