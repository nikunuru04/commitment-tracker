import * as React from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "outline" | "ghost" | "error" | "secondary";
type Size = "sm" | "md" | "icon" | "icon-sm";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  error: "btn-error text-white",
};

const sizeClass: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  icon: "btn-circle",
  "icon-sm": "btn-sm btn-circle",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn("btn rounded-btn", variantClass[variant], sizeClass[size], className)}
      {...props}
    />
  );
}
