"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  MdMoreVert,
  MdOutlineCheck,
  MdOutlineContentCopy,
  MdOutlineDeleteForever,
  MdOutlineEdit,
  MdOutlineLinkOff,
} from "react-icons/md";

import { useServerAction } from "@/hooks/use-server-action";

import { cx } from "@/components/ui";
import { deleteEvent } from "@/lib/actions/lifecycle";

/**
 * The three things a host wants from an event without opening it: change its
 * name or date, hand the link to somebody, or get rid of it.
 *
 * It lives on the card, which is itself a link, so the trigger has to sit above
 * that link and stop its clicks - see `EventCard` for the other half.
 */
export function EventCardMenu({
  eventId,
  eventName,
  shareLink,
}: {
  eventId: string;
  eventName: string;
  /** Null when the host has turned the link off. Copying is then meaningless. */
  shareLink: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLElement | null>>([]);
  const { pending, error, setError, run } = useServerAction();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Escape gives the focus back to what opened the panel, not to the page.
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Opening with a keyboard has to land somewhere, and the first item is the
  // only sensible somewhere. Harmless with a mouse: nothing here moves on focus.
  useEffect(() => {
    if (open) items.current[0]?.focus();
    else setError(null);
  }, [open, setError]);

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const usable = items.current.filter(
      (el): el is HTMLElement => el !== null && !isDisabled(el),
    );
    if (usable.length === 0) return;
    const at = usable.findIndex((el) => el === document.activeElement);
    const last = usable.length - 1;
    const next =
      event.key === "ArrowDown"
        ? at >= last
          ? 0
          : at + 1
        : event.key === "ArrowUp"
          ? at <= 0
            ? last
            : at - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    usable[next].focus();
  }

  /**
   * The panel stays open and the item says so, rather than a message arriving
   * somewhere else on the page. It is where the finger already is.
   */
  async function copy() {
    if (!shareLink) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1400);
    } catch {
      setError("Could not reach the clipboard.");
    }
  }

  function remove() {
    run(() => deleteEvent(eventId), {
      confirm: `Delete "${eventName}" and every photo in it? This cannot be undone.`,
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Options for ${eventName}`}
        className={cx(
          "grid size-10 shrink-0 touch-manipulation place-items-center rounded-full text-[1.25rem] text-ash transition-colors",
          "hover:bg-blush hover:text-ink",
          "focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink",
          open && "bg-blush text-ink",
        )}
      >
        <MdMoreVert aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Options for ${eventName}`}
          onKeyDown={move}
          /* Right-anchored: the card's own right edge is the nearest edge, and
             a panel growing the other way hangs off a phone. */
          className="card absolute right-0 top-[calc(100%+0.375rem)] z-50 w-56 p-1.5 shadow-lg"
        >
          <Link
            ref={(el) => {
              items.current[0] = el;
            }}
            role="menuitem"
            href={`/dashboard/events/${eventId}#settings`}
            onClick={() => setOpen(false)}
            className={ITEM}
          >
            <MdOutlineEdit aria-hidden className="shrink-0 text-[1.25em]" />
            Edit
          </Link>

          <button
            ref={(el) => {
              items.current[1] = el;
            }}
            role="menuitem"
            type="button"
            onClick={copy}
            disabled={!shareLink}
            className={ITEM}
          >
            {shareLink === null ? (
              <MdOutlineLinkOff aria-hidden className="shrink-0 text-[1.25em]" />
            ) : copied ? (
              <MdOutlineCheck aria-hidden className="shrink-0 text-[1.25em]" />
            ) : (
              <MdOutlineContentCopy
                aria-hidden
                className="shrink-0 text-[1.25em]"
              />
            )}
            {shareLink === null ? "No active link" : copied ? "Copied" : "Copy link"}
          </button>

          <hr className="my-1.5 border-edge" />

          <button
            ref={(el) => {
              items.current[2] = el;
            }}
            role="menuitem"
            type="button"
            onClick={remove}
            disabled={pending}
            className={cx(ITEM, "text-claret")}
          >
            <MdOutlineDeleteForever
              aria-hidden
              className="shrink-0 text-[1.25em]"
            />
            {pending ? "Deleting…" : "Delete"}
          </button>

          {error && (
            <p className="px-3 pb-1.5 pt-1 text-[0.8125rem] leading-snug text-claret">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const ITEM =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[0.9375rem] font-semibold leading-tight transition-colors hover:bg-blush focus:outline-none focus-visible:bg-blush disabled:opacity-45 disabled:pointer-events-none";

function isDisabled(el: HTMLElement): boolean {
  return el instanceof HTMLButtonElement && el.disabled;
}
