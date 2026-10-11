"use client";

import { useEffect, useState } from "react";

import { inAppBrowser } from "@/lib/media/accept";

export function useInAppBrowser(): string | null {
  const [app, setApp] = useState<string | null>(null);

  useEffect(() => {
    setApp(
      inAppBrowser(
        typeof navigator === "undefined" ? undefined : navigator.userAgent,
      ),
    );
  }, []);

  return app;
}
