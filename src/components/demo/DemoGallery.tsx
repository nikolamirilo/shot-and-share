"use client";

import { useState } from "react";

import { Lightbox } from "@/components/gallery/Lightbox";
import { PhotoGallery } from "@/components/gallery/PhotoGallery";
import { DEMO_MEDIA } from "@/lib/demo";
import { neighbours, upcoming } from "@/utils/gallery";
import type { MediaView } from "@/types/media";

/** `added` is whatever the visitor put in from this browser, newest first. */
export function DemoGallery({ added = [] }: { added?: MediaView[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const items = [...added, ...DEMO_MEDIA];
  const openIndex = openId ? items.findIndex((item) => item.id === openId) : -1;
  const open = openIndex === -1 ? null : items[openIndex];
  const step = open ? neighbours(items, open.id) : null;

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[1.625rem] sm:text-h2">Everyone&apos;s photos</h2>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
          {added.length > 0
            ? `${items.length} so far, ${added.length} yours`
            : `${items.length} so far`}
        </span>
      </div>

      <PhotoGallery
        items={items}
        layout="masonry"
        onActivate={(item) => setOpenId(item.id)}
        className="mt-6"
      />

      {open && step && (
        <Lightbox
          token=""
          demo
          item={open}
          prev={step.prev}
          next={step.next}
          position={openIndex + 1}
          total={items.length}
          preload={upcoming(items, open.id)}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
