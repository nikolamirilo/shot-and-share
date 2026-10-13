"use client";

import { useState } from "react";
import {
  MdOutlineAddAPhoto,
  MdOutlinePhotoCamera,
  MdOutlinePhotoLibrary,
} from "react-icons/md";

import { BUTTON_FILL, Button, ButtonLabel, Hole, cx } from "@/components/ui";
import type { UploadVariant } from "@/lib/appearance/variants";

export interface UploadPanelProps {
  variant: UploadVariant;
  label: string;
  captureLabel?: string;
  chooseLabel?: string;
  hint: string;
  busy?: boolean;
  pickFor?: string;
  captureFor?: string;
  onPick?: () => void;
  onCapture?: () => void;
  onDropFiles?: (files: FileList) => void;
  children?: React.ReactNode;
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
      {!preview && <Consent />}
    </section>
  );
}

function Consent() {
  return (
    <p className="mt-3 px-1 text-center text-[0.8125rem] leading-relaxed text-ash">
      By uploading you confirm you have permission from the people in your
      photos.{" "}
      <a
        href="/acceptable-use"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        What is not allowed
      </a>
    </p>
  );
}

function BigButton({
  label,
  hint,
  busy,
  pickFor,
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
        htmlFor={pickFor}
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

function DropPanel({
  label,
  hint,
  busy,
  pickFor,
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

  const shell = cx(
    "inset-shadow-well block w-full rounded-[1.25rem] text-center transition-colors",
    over ? "bg-blush" : "bg-linen",
    preview ? "p-3" : "px-5 py-7 sm:p-8",
  );

  const dragging = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      if (e.dataTransfer.files.length > 0) onDropFiles?.(e.dataTransfer.files);
    },
  };

  return (
    <div>
      {preview ? (
        <div className={shell}>{inside}</div>
      ) : pickFor ? (
        <label
          htmlFor={pickFor}
          {...dragging}
          className={cx(shell, "cursor-pointer", busy && "pointer-events-none opacity-45")}
        >
          {inside}
        </label>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onPick}
          {...dragging}
          className={cx(shell, "disabled:opacity-45")}
        >
          {inside}
        </button>
      )}
      {children}
    </div>
  );
}

function SlimBar({
  label,
  hint,
  busy,
  pickFor,
  onPick,
  preview,
  children,
}: UploadPanelProps) {
  return (
    <div className={cx("card", preview ? "p-2.5" : "p-4")}>
      <Action
        label={label}
        icon={<MdOutlineAddAPhoto aria-hidden className="shrink-0 text-[1.25em]" />}
        busy={busy}
        htmlFor={pickFor}
        onClick={onPick}
        preview={preview}
        className="w-full"
      />
      <Hint text={hint} preview={preview} />
      {children}
    </div>
  );
}

function SplitButtons({
  label,
  captureLabel = "Take a photo",
  chooseLabel = "Choose photos",
  hint,
  busy,
  pickFor,
  captureFor,
  onPick,
  onCapture,
  preview,
  children,
}: UploadPanelProps) {
  return (
    <div className={cx("card", preview ? "p-3" : "p-5 sm:p-6")}>
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
          htmlFor={captureFor}
          onClick={onCapture}
          preview={preview}
          className={preview ? "py-2" : "py-4"}
        />
        <Action
          label={chooseLabel}
          icon={<MdOutlinePhotoLibrary aria-hidden className="shrink-0 text-[1.25em]" />}
          busy={busy}
          htmlFor={pickFor}
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

function Action({
  label,
  icon,
  busy,
  htmlFor,
  onClick,
  preview,
  variant = "primary",
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  busy?: boolean;
  htmlFor?: string;
  onClick?: () => void;
  preview?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  if (preview) {
    return (
      <span
        className={cx(
          "inline-flex items-center justify-center gap-1.5 rounded-control px-3 text-label font-semibold shadow-md",
          BUTTON_FILL[variant],
          className,
        )}
      >
        {icon}
        {label}
      </span>
    );
  }

  if (htmlFor) {
    return (
      <ButtonLabel
        size="lg"
        variant={variant}
        disabled={busy}
        htmlFor={htmlFor}
        className={className}
      >
        {icon}
        {label}
      </ButtonLabel>
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
