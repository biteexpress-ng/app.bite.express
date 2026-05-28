import Link from "next/link";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "ghost-light"
  | "neon";
type Size = "xs" | "sm" | "md" | "lg" | "xl";

const variantStyles: Record<Variant, string> = {
  primary: "btn-flame",
  secondary: "btn-obsidian",
  outline:
    "border border-ink-300/80 bg-white/60 text-ink-900 backdrop-blur hover:bg-white hover:border-ink-400 active:bg-ink-100",
  ghost:
    "bg-transparent text-ink-900 hover:bg-ink-100 active:bg-ink-200",
  "ghost-light": "btn-ghost-light",
  neon:
    "bg-white text-brand-red border border-brand-red/20 shadow-[0_8px_24px_-8px_rgba(222,22,0,0.35)] hover:border-brand-red/40 hover:shadow-[0_12px_32px_-8px_rgba(222,22,0,0.5)]",
};

const sizeStyles: Record<Size, string> = {
  xs: "h-8 px-3 text-xs",
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-[0.95rem]",
  lg: "h-14 px-8 text-base",
  xl: "h-16 px-10 text-lg",
};

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium tracking-[-0.005em] " +
  "transition-[transform,box-shadow,background,color,filter] duration-200 ease-out " +
  "select-none whitespace-nowrap " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type AnchorProps = BaseProps & {
  href: string;
  external?: boolean;
  prefetch?: boolean;
};

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  external,
  prefetch,
  children,
}: AnchorProps) {
  const classes = cn(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
  if (external) {
    return (
      <a
        href={href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} prefetch={prefetch}>
      {children}
    </Link>
  );
}
