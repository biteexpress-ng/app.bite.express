import Link from "next/link";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-brand-red text-white hover:bg-brand-red-600 active:bg-brand-red-700 shadow-sm",
  secondary:
    "bg-brand-black text-white hover:bg-ink-700 active:bg-ink-900 shadow-sm",
  outline:
    "border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 active:bg-ink-100",
  ghost: "bg-transparent text-ink-900 hover:bg-ink-100 active:bg-ink-200",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-colors duration-150 ease-out " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2";

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type AnchorProps = BaseProps & {
  href: string;
  external?: boolean;
};

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
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
  children,
}: AnchorProps) {
  const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
