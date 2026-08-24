"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { acceptAttribute } from "@/lib/media/accept";

/**
 * Opening a file picker and getting the files back out of it.
 *
 * This looks like it should be four lines - an input, a ref, a click, an
 * onChange - and it is the single most fragile thing on the guest page, because
 * every part of it happens outside the page. The sheet that opens belongs to
 * the operating system, the page is frozen or discarded while it is up, and
 * what arrives afterwards is whatever the browser decides to deliver.
 *
 * The reported break: on recent iOS a guest selects photos, taps the button
 * that confirms the selection, and nothing happens. Same page, same phone,
 * older iOS - fine. So everything here is a belt-and-braces version of the four
 * lines, and none of it changes what the page looks like.
 */

/**
 * Hidden, but a real element on the page.
 *
 * Not `sr-only`: that clips the input to nothing and hides its overflow, and a
 * file input with no box has been an unreliable thing to open from script on
 * iOS for several releases. `display: none` and `visibility: hidden` are worse
 * again - some browsers refuse to open those at all. A real 1px box at zero
 * opacity, behind the page and out of the tab order, opens everywhere.
 *
 * Nothing here makes it uninteractive - no `pointer-events: none`, no
 * `disabled` - because "can this be interacted with" is part of what a browser
 * asks itself before it agrees to open a picker from script.
 */
export const HIDDEN_FILE_INPUT =
  "fixed bottom-0 left-0 -z-10 h-px w-px opacity-0";

export interface FilePicker {
  /** Put this on the `<input type="file">`. */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Call from the button. Must stay inside the tap - see below. */
  open: () => void;
}

/**
 * Wires one hidden file input to one button.
 *
 * `onFiles` is read from a ref, so the listeners below are attached once and
 * never see a stale copy of the queue.
 */
export function useFilePicker(onFiles: (files: File[]) => void): FilePicker {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handler = useRef(onFiles);
  handler.current = onFiles;

  /**
   * The selection already dealt with, by identity.
   *
   * There are three ways files can arrive below and any of them can fire twice,
   * so the guard is the FileList object itself rather than a boolean: a fresh
   * pick is always a fresh list, and a repeat delivery of the same pick is
   * always the same one.
   */
  const handled = useRef<FileList | null>(null);
  /** A picker we opened and have not been paid for yet. */
  const waiting = useRef(false);

  const take = useCallback(() => {
    const input = inputRef.current;
    const list = input?.files;
    if (!list || list.length === 0) return;
    if (handled.current === list) return;

    handled.current = list;
    waiting.current = false;
    // Copied out of the live FileList before anything is awaited. The list
    // belongs to the input and the File objects do not - so the copy survives
    // the input being cleared, re-rendered or unmounted mid-upload.
    handler.current(Array.from(list));
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    // Listened for on the element itself rather than through React's onChange.
    // React listens at the root of the app and replays what it hears; a native
    // listener on the input is one less thing between the sheet and the queue.
    // `input` as well as `change`, because they are not both fired everywhere
    // and either one means the same thing here.
    const deliver = () => take();
    input.addEventListener("change", deliver);
    input.addEventListener("input", deliver);

    /**
     * The safety net, and the reason this file exists.
     *
     * If the change event never arrives - the page was frozen while the sheet
     * was up, the event was swallowed, the picker returned in a way this
     * browser does not report - the files are still sitting on the input when
     * the page comes back. So when the page comes back, look.
     *
     * Twice more after a beat, because on a phone the files are sometimes not
     * attached yet at the moment focus returns: a large selection is still
     * being converted out of HEIC while the page is already visible again.
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
      input.removeEventListener("change", deliver);
      input.removeEventListener("input", deliver);
      window.removeEventListener("focus", sweep);
      document.removeEventListener("visibilitychange", onVisible);
      for (const timer of timers) clearTimeout(timer);
    };
  }, [take]);

  const open = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    handled.current = null;
    waiting.current = true;
    // Cleared here rather than after the upload, so picking the same photo
    // twice still counts as a new selection - and so the input is never
    // emptied while a file taken out of it is still being read.
    try {
      input.value = "";
    } catch {
      // Some browsers refuse the assignment. The identity guard above covers
      // the case this was protecting against.
    }

    // Nothing may be awaited before this line: a picker only opens while the
    // browser still considers itself inside the guest's tap.
    input.click();
  }, []);

  return { inputRef, open };
}

/**
 * The accept list for this browser, decided after the page has loaded.
 *
 * The server has no user agent to hand to `acceptAttribute` that the client
 * would agree with, so the first render is the full list either way and Safari
 * swaps to the short one on mount. That ordering is deliberate: it keeps the
 * markup the server sent and the markup React expects identical, and the swap
 * lands long before anybody can tap the button.
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
