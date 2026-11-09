import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10.5 sm:h-11 w-full rounded-xl border border-border/80 bg-secondary/35 px-3.5 py-2 text-sm sm:text-base text-foreground font-bold shadow-2xs transition-all duration-150 touch-manipulation file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-foreground placeholder:text-muted-foreground/60 focus:bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
