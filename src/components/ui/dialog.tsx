"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/** Accessible modal (Radix): focus trap, Escape to close, labelled by title/description. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-ink/40 fixed inset-0 z-50" />
        <RadixDialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            "bg-surface fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl p-6 shadow-2xl",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="font-display text-ink text-xl font-medium">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-muted mt-1 text-sm">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close
              className="text-muted hover:bg-paper-2 hover:text-ink grid size-10 flex-none place-items-center rounded-md"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          {children}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Confirmation for destructive or consequential actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Go back",
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    />
  );
}
