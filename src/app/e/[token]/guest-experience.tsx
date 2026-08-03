"use client";

import { useEffect, useState } from "react";

import { GuestGallery } from "@/app/e/[token]/guest-gallery";
import { Uploader } from "@/app/e/[token]/uploader";
import { markOpened } from "@/lib/client/upload";
import type { GalleryLayout } from "@/lib/gallery";

export function GuestExperience({
  token,
  eventId,
  galleryVisible,
  galleryLayout,
  allowVideo,
  maxFileBytes,
  remainingBytes,
}: {
  token: string;
  eventId: string;
  galleryVisible: boolean;
  galleryLayout: GalleryLayout;
  allowVideo: boolean;
  maxFileBytes: number;
  remainingBytes: number;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Once per browser per event, so the opened-then-uploaded number is not
    // inflated by every scroll back to the page during the night.
    if (!markOpened(eventId)) return;
    fetch("/api/guest/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => {});
  }, [eventId, token]);

  return (
    <>
      <Uploader
        token={token}
        allowVideo={allowVideo}
        maxFileBytes={maxFileBytes}
        remainingBytes={remainingBytes}
        onUploaded={() => setRefreshKey((k) => k + 1)}
      />
      {galleryVisible && (
        <GuestGallery
          token={token}
          refreshKey={refreshKey}
          eventLayout={galleryLayout}
        />
      )}
    </>
  );
}
