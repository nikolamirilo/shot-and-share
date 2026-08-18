"use client";

import { useState } from "react";
import {
  MdOutlineAddAPhoto,
  MdOutlinePhotoCamera,
  MdOutlinePhotoLibrary,
} from "react-icons/md";

import { Button, Hole, cx } from "@/components/ui";
import type { UploadVariant } from "@/lib/appearance/variants";

/**
 * The shape of the ask, with none of the machinery. useUploadQueue owns
 * compression, presigning, retries and progress; this owns what a guest looks
 * at - which is what lets the host's preview render the real thing.
 *
 * Every variant keeps the same two parts: one obvious action, and the line
 * saying what may be sent. They differ in how much of the screen they take,
 * because that is the choice a host is making.
 */

export interface UploadPanelProps {
  variant: UploadVariant;
  /** The primary action's label. Carries the progress text while busy. */
  label: string;
  /**
   * The two halves of the split variant. They follow the plan the same way
   * `label` does - a plan with video asks for files and opens a camera, not for
   * photographs - so they are passed in rather than written here.
   */
  captureLabel?: string;
  chooseLabel?: string;
  /** What may be sent, and how much room is left. */
  hint: string;
  busy?: boolean;
  onPick?: () => void;
  /** Only "Camera or library" offers the camera as its own button. */
  onCapture?: () => void;
  /** Files dropped onto the panel variant from a laptop. */
  onDropFiles?: (files: FileList) => void;
  /** Progress, the thank-you note, and errors. */
  children?: React.ReactNode;
  /**
   * Static rendering for the host's preview: smaller, and nothing here can be
   * clicked, focused or read out - it is a picture of the page, not the page.
   */
  preview?: boolean;
}

export function UploadPanel(props: UploadPanelProps) {
  const { variant, preview } = props;

  return (
    <section
      className={preview ? undefined : "mt-6 sm:mt-8"}
      aria-hidden={preview}
      inert={preview}
    >
      {variant === "panel" ? (
        <DropPanel {...props} />
      ) : variant === "bar" ? (
        <SlimBar {...props} />
      ) : variant === "split" ? (
        <SplitButtons {...props} />
      ) : (
        <BigButton {...props} />
      )}
    </section>
  );
}

/* --- the variants --------------------------------------------------------- */

/** One wide button on a card. The default, and the loudest. */
function BigButton({
  label,
  hint,
  busy,
  onPick,
  preview,
  children,
}: UploadPanelProps) {
  return (
    <div className={cx("card", preview ? "p-3" : "p-5 sm:p-6")}>
      <Action
        label={label}
        icon={<MdOutlineAddAPhoto aria-hidden className="shrink-0 text-[1.25em]" />}
        busy={busy}
        onClick={onPick}
        preview={preview}
        className={cx(
          "w-full",
          preview ? "py-2" : "min-h-16 py-4 text-[1.15rem] sm:py-5 sm:text-[1.3rem]",
        )}
      />
      <Hint text={hint} preview={preview} className="text-center" />
      {children}
    </div>
  );
}

/**
 * The panel *is* the button, so the tap target is the whole thing and a laptop
 * can drop files anywhere on it.
 */
function DropPanel({
  label,
  hint,
  busy,
  onPick,
  onDropFiles,
  preview,
  children,
}: UploadPanelProps) {
  const [over, setOver] = useState(false);

  const inside = (
    <>
      <span className={cx("flex items-end justify-center", preview ? "gap-1.5" : "gap-3")}>
        <Hole size={preview ? 8 : 18} />
        <Hole size={preview ? 14 : 30} />
        <Hole size={preview ? 6 : 13} />
      </span>
      <span
        className={cx(
          "mt-3 block font-semibold leading-tight",
          preview ? "text-label" : "text-lead",
        )}
      >
        {label}
      </span>
      <span
        className={cx(
          "mt-1 block text-ash",
          preview ? "text-[0.625rem]" : "text-small",
        )}
      >
        {hint}
      </span>
    </>
  );

  // Sunken rather than dashed: a well the page steps down into says "drop
  // here" without a line on a page that has none. A drag fills it with Gouda.
  const shell = cx(
    "inset-shadow-well block w-full rounded-[1.25rem] text-center transition-colors",
    over ? "bg-blush" : "bg-linen",
    preview ? "p-3" : "px-5 py-7 sm:p-8",
  );

  return (
    <div>
      {preview ? (
        <div className={shell}>{inside}</div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onPick}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (e.dataTransfer.files.length > 0) onDropFiles?.(e.dataTransfer.files);
          }}
          className={cx(shell, "disabled:opacity-45")}
        >
          {inside}
        </button>
      )}
      {children}
    </div>
  );
}

/** A compact row, so the gallery starts higher up the screen. */
function SlimBar({
  label,
  hint,
  busy,
  onPick,
  preview,
  children,
}: UploadPanelProps) {
  return (
    <div className={cx("card", preview ? "p-2.5" : "p-4")}>
      {/* Full width now that nothing sits beside it. A button that stops short
          of the card's edge on a phone reads as half a row waiting for the
          other half, which is what this used to be. */}
      <Action
        label={label}
        icon={<MdOutlineAddAPhoto aria-hidden className="shrink-0 text-[1.25em]" />}
        busy={busy}
        onClick={onPick}
        preview={preview}
        className="w-full"
      />
      <Hint text={hint} preview={preview} />
      {children}
    </div>
  );
}

/**
 * Two buttons: a guest at the party wants the camera, a guest on the sofa
 * afterwards wants the camera roll. Asking is cheaper than guessing.
 */
function SplitButtons({
  label,
  captureLabel = "Take a photo",
  chooseLabel = "Choose photos",
  hint,
  busy,
  onPick,
  onCapture,
  preview,
  children,
}: UploadPanelProps) {
  return (
    <div className={cx("card", preview ? "p-3" : "p-5 sm:p-6")}>
      {/* Half a phone's width does not hold "Choose photos" at 17px, and a
          two-line button beside a one-line one is the worst thing on the guest
          page. Below 480 they stack full width. */}
      <div
        className={cx(
          "grid",
          preview
            ? "grid-cols-2 gap-2"
            : "grid-cols-1 gap-2.5 xs:grid-cols-2 sm:gap-3",
        )}
      >
        <Action
          label={busy ? label : captureLabel}
          icon={<MdOutlinePhotoCamera aria-hidden className="shrink-0 text-[1.25em]" />}
          busy={busy}
          onClick={onCapture}
          preview={preview}
          className={preview ? "py-2" : "py-4"}
        />
        <Action
          label={chooseLabel}
          icon={<MdOutlinePhotoLibrary aria-hidden className="shrink-0 text-[1.25em]" />}
          busy={busy}
          onClick={onPick}
          preview={preview}
          variant="secondary"
          className={preview ? "py-2" : "py-4"}
        />
      </div>
      <Hint text={hint} preview={preview} className="text-center" />
      {children}
    </div>
  );
}

/* --- the shared parts ----------------------------------------------------- */

function Action({
  label,
  icon,
  busy,
  onClick,
  preview,
  variant = "primary",
  className,
}: {
  label: string;
  /**
   * Names the action beside the label. Drawn in the preview too - a host
   * looking at a picture of their guest page has to see what the guests get.
   */
  icon?: React.ReactNode;
  busy?: boolean;
  onClick?: () => void;
  preview?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  // A preview must not put a second "Add your photos" button in the host's tab
  // order, so it renders the same box without being one.
  if (preview) {
    return (
      <span
        className={cx(
          "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 text-label font-semibold",
          variant === "primary"
            ? "bg-ink text-linen shadow-md"
            : "bg-paper text-ink shadow-md",
          className,
        )}
      >
        {icon}
        {label}
      </span>
    );
  }

  return (
    <Button
      size="lg"
      variant={variant}
      disabled={busy}
      onClick={onClick}
      className={className}
    >
      {icon}
      {label}
    </Button>
  );
}

function Hint({
  text,
  preview,
  className,
}: {
  text: string;
  preview?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "text-ash",
        preview ? "mt-2 text-[0.625rem] leading-snug" : "mt-3 text-small",
        className,
      )}
    >
      {text}
    </p>
  );
}
