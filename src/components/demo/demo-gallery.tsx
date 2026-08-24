"use client";

import { useState } from "react";

import { Lightbox } from "@/components/gallery/lightbox";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { DEMO_MEDIA } from "@/lib/demo";
import { neighbours, upcoming } from "@/lib/gallery";

/**
 * The demo wall.
 *
 * The same `PhotoGallery` and `Lightbox` a real guest gets, so this page cannot
 * quietly become a mock-up of a product that has moved on. Opening, stepping,
 * swiping and the keyboard all work because none of it is reimplemented here.
 */
export function DemoGallery() {
  const [openId, setOpenId] = useState<string | null>(null);

  const openIndex = openId
    ? DEMO_MEDIA.findIndex((item) => item.id === openId)
    : -1;
  const open = openIndex === -1 ? null : DEMO_MEDIA[openIndex];
  const step = open
    ? neighbours(
        DEMO_MEDIA.map((item) => item.id),
        open.id,
      )
    : null;

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[1.625rem] sm:text-h2">Everyone&apos;s photos</h2>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
          {DEMO_MEDIA.length} so far
        </span>
      </div>

      <PhotoGallery
        items={DEMO_MEDIA}
        layout="masonry"
        onActivate={(item) => setOpenId(item.id)}
        className="mt-6"
      />

      {open && step && (
        <Lightbox
          // No share token exists for a page anybody can open. `demo` is what
          // tells the lightbox not to go looking for a signed URL.
          token=""
          demo
          item={open}
          prevId={step.prev}
          nextId={step.next}
          position={openIndex + 1}
          total={DEMO_MEDIA.length}
          preload={upcoming(DEMO_MEDIA, open.id)}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
