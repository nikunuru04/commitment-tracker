import {
  Wallet, GraduationCap, Home, Car, Fuel, Heart, Utensils, PiggyBank, Wrench,
  ShoppingCart, Tag, type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Wallet,
  GraduationCap,
  Home,
  Car,
  Fuel,
  Heart,
  Utensils,
  PiggyBank,
  Wrench,
  ShoppingCart,
  Tag,
};

export function categoryIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Tag;
}
