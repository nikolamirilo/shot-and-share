"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdMoreVert,
  MdOutlineCheck,
  MdOutlineContentCopy,
  MdOutlineDeleteForever,
  MdOutlineEdit,
  MdOutlineLinkOff,
} from "react-icons/md";

import { useServerAction } from "@/hooks/useServerAction";

import { cx } from "@/components/ui";
import { deleteEvent } from "@/lib/actions/lifecycle";

export function EventCardMenu({
  eventId,
  eventName,
  shareLink,
}: {
  eventId: string;
  eventName: string;
  shareLink: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState({ top: 0, left: 0 });
  const [copied, setCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = useRef<Array<HTMLElement | null>>([]);
  const { pending, error, setError, run } = useServerAction();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (!menuRef.current?.contains(target)) setOpen(false);
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function close() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

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

  // The menu is portalled out of the card, so it is placed off the button's own box.
  function place() {
    const at = buttonRef.current?.getBoundingClientRect();
    if (!at) return;
    const room = window.innerHeight - at.bottom;
    setSpot({
      top: room < HEIGHT + 12 ? Math.max(8, at.top - HEIGHT - 6) : at.bottom + 6,
      left: Math.min(
        Math.max(8, at.right - WIDTH),
        Math.max(8, window.innerWidth - WIDTH - 8),
      ),
    });
  }

  function toggle() {
    if (!open) place();
    setOpen((was) => !was);
  }

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
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
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

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Options for ${eventName}`}
            onKeyDown={move}
            style={{ top: spot.top, left: spot.left, width: WIDTH }}
            className="card fixed z-[60] p-1.5 shadow-lg"
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
          </div>,
          document.body,
        )}
    </>
  );
}

const WIDTH = 224;
// Only used to decide whether the menu opens downwards or up out of the button.
const HEIGHT = 160;

const ITEM =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[0.9375rem] font-semibold leading-tight transition-colors hover:bg-blush focus:outline-none focus-visible:bg-blush disabled:opacity-45 disabled:pointer-events-none";

function isDisabled(el: HTMLElement): boolean {
  return el instanceof HTMLButtonElement && el.disabled;
}
