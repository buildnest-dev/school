import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "group inline-flex items-center justify-center gap-2.5 rounded-sm border border-transparent font-semibold transition-[background-color,color,border-color,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-accent-ink",
        ghost: "border-ink bg-transparent text-ink hover:bg-ink hover:text-white",
        light: "bg-paper text-ink hover:bg-accent-light",
        "outline-light": "border-on-dark text-white hover:border-white hover:bg-white/10",
      },
      size: {
        md: "min-h-12 px-6 text-[0.95rem]",
        sm: "min-h-10 px-[18px] text-[0.9rem]",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a Next.js Link) with button styling. */
  asChild?: boolean;
}

export function Button({ className, variant, size, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
