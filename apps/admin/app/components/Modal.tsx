"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Thin adapter over the shadcn/Radix Dialog primitives.
 *
 * Keeps the legacy props API (`isOpen`/`onClose`) so existing call sites
 * keep compiling; Escape-to-close, backdrop-click close, focus trapping
 * and aria attributes are provided by Radix.
 */
export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {/* Radix requires a Description or explicit aria-describedby={undefined};
              DialogContent sets that via the hidden description below. */}
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <div>{children}</div>

        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
