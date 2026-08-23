import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border border-border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "border-[var(--danger)]/30 bg-[var(--danger-light)] text-[var(--danger)] [&>svg]:text-current *:data-[slot=alert-description]:text-[var(--danger)]/90",
        success:
          "border-[var(--success)]/30 bg-[var(--success-light)] text-[var(--success)] [&>svg]:text-current *:data-[slot=alert-description]:text-[var(--success)]/90",
        warning:
          "border-[var(--warning)]/30 bg-[var(--warning-light)] text-[var(--warning)] [&>svg]:text-current *:data-[slot=alert-description]:text-[var(--warning)]/90",
        info: "border-[var(--info)]/30 bg-[var(--info-light)] text-[var(--info)] [&>svg]:text-current *:data-[slot=alert-description]:text-[var(--info)]/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm opacity-80 [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle, alertVariants };
