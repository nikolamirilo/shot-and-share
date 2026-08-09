import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { it } from "vitest";

import { AppearanceForm } from "@/app/dashboard/events/[id]/appearance-form";
import type { EventRow } from "@/lib/db/types";

const event: EventRow = {
  id: "e1",
  owner_id: "o1",
  name: "Ana and Marko",
  event_date: "2026-09-12",
  tier: "wheel",
  keep_forever: false,
  storage_quota_bytes: 1,
  storage_used_bytes: 0,
  expires_at: null,
  status: "active",
  gallery_visible: true,
  gallery_layout: "grid",
  theme: "cheese",
  theme_custom: {},
  theme_font: "cheese",
  cover_variant: "classic",
  upload_variant: "button",
  welcome_message: "Send us the ones you took.",
  cover_media_id: null,
  link_opens: 0,
  archive_key: null,
  archive_built_at: null,
  archive_size_bytes: null,
  archive_builds: 0,
  warned_at_days: null,
  deleted_at: null,
  created_at: "2026-01-01",
};

it("writes the markup out for a look", () => {
  const html = renderToStaticMarkup(
    <AppearanceForm event={event} media={[]} locked={false} />,
  );
  writeFileSync(process.env.VISUAL_OUT!, html);
});
