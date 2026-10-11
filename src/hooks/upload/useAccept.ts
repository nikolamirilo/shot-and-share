"use client";

import { useEffect, useState } from "react";

import { acceptAttribute } from "@/lib/media/accept";

/**
 * Decided after load: the server has no user agent the client would agree with, so the
 * first render is the full list either way.
 */
export function useAccept(video: boolean): string {
  const [accept, setAccept] = useState(() => acceptAttribute({ video }));

  useEffect(() => {
    setAccept(
      acceptAttribute({
        video,
        ua: typeof navigator === "undefined" ? undefined : navigator.userAgent,
      }),
    );
  }, [video]);

  return accept;
}
