"use client";

import { useSyncExternalStore } from "react";

import {
  isOptimiserOff,
  optimiserServerSnapshot,
  subscribeToOptimiser,
} from "@/lib/client/image-optimizer";

export function useOptimiserOff(): boolean {
  return useSyncExternalStore(
    subscribeToOptimiser,
    isOptimiserOff,
    optimiserServerSnapshot,
  );
}
