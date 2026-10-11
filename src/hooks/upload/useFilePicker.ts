"use client";

import { useCallback, useEffect, useRef } from "react";

import type { FilePicker } from "@/types/upload";

export function useFilePicker(onFiles: (files: File[]) => void): FilePicker {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handler = useRef(onFiles);
  handler.current = onFiles;

  const handled = useRef<FileList | null>(null);
  const waiting = useRef(false);

  const take = useCallback(() => {
    const input = inputRef.current;
    const list = input?.files;
    if (!list || list.length === 0) return;
    if (handled.current === list) return;

    handled.current = list;
    waiting.current = false;
    handler.current(Array.from(list));
  }, []);

  const arm = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    handled.current = null;
    waiting.current = true;
    try {
      input.value = "";
    } catch {
    }
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.addEventListener("click", arm);

    // A native listener on the input, not React's onChange, which listens at the app
    // root. `input` as well as `change`, because they are not both fired everywhere.
    const deliver = () => take();
    input.addEventListener("change", deliver);
    input.addEventListener("input", deliver);

    /**
     * The safety net. If the change event never arrives, the files are still on
     * the input when the page comes back - so look then, and twice more after a
     * beat, because a large selection is sometimes not attached yet.
     */
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sweep = () => {
      if (!waiting.current) return;
      take();
      timers.push(setTimeout(take, 300), setTimeout(take, 1200));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sweep();
    };

    window.addEventListener("focus", sweep);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      input.removeEventListener("click", arm);
      input.removeEventListener("change", deliver);
      input.removeEventListener("input", deliver);
      window.removeEventListener("focus", sweep);
      document.removeEventListener("visibilitychange", onVisible);
      for (const timer of timers) clearTimeout(timer);
    };
  }, [arm, take]);

  const open = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return { inputRef, open };
}
