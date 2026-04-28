import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-lieferando focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-neutral-900 text-white hover:bg-neutral-800",
        secondary: "border-transparent bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
        outline: "border-neutral-200 text-neutral-700",
        success: "border-transparent bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
        warning: "border-transparent bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
        danger: "border-transparent bg-red-100 text-red-800 ring-1 ring-inset ring-red-200",
        info: "border-transparent bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200",
        lieferando: "border-transparent bg-lieferando-50 text-lieferando-dark ring-1 ring-inset ring-lieferando/30",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
