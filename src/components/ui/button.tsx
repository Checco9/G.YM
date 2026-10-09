import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-transform active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none";
const variants: Record<Variant, string> = {
  primary: "bg-fg text-onfg",
  secondary: "bg-surface2 text-fg",
  ghost: "hover:bg-surface2",
  danger: "bg-danger/15 text-danger",
};
const sizes: Record<Size, string> = {
  sm: "h-10 px-3.5 text-[15px]",
  md: "h-12 px-5 text-base",
  lg: "h-14 px-6 text-lg",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra = "") =>
  `${base} ${variants[variant]} ${sizes[size]} ${extra}`;

type Common = { variant?: Variant; size?: Size; icon?: IconName; className?: string; children?: ReactNode };

export function Button({
  variant,
  size,
  icon,
  className,
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant,
  size,
  icon,
  className,
  children,
}: Common & { href: string }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </Link>
  );
}

export function IconButton({
  icon,
  label,
  className = "",
  ...rest
}: { icon: IconName; label: string; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface2 active:bg-surface2 disabled:opacity-40 ${className}`}
      {...rest}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
