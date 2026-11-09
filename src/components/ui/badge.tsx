import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-primary/25 bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90",
        secondary:
          "border-border/70 bg-secondary/80 text-secondary-foreground hover:bg-secondary",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline:
          "border-border/80 bg-background/50 text-foreground",
        emerald:
          "border-[#168063]/30 bg-[#168063]/10 text-[#168063] dark:text-[#22A07E]",
        gold:
          "border-[#C5A059]/35 bg-[#C5A059]/12 text-[#C5A059] dark:text-[#E0BC75]",
        blue:
          "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
