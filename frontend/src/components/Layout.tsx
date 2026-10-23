import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Banknote, ListChecks, ArrowLeftRight, CalendarDays,
  PieChart, Settings, Heart, Menu, X, ChevronLeft, ChevronRight, ChevronDown,
  LogOut, Flower2, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatMonthLong } from "../lib/format";
import { useMonthParam } from "../lib/useMonthParam";
import { useAppSettings } from "../lib/queries";
import { setToken } from "../lib/api";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { MonthPicker } from "./ui/month-picker";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/income", label: "Income", icon: Banknote },
  { to: "/commitments", label: "Commitments", icon: ListChecks },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/reports", label: "Reports", icon: PieChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1.5 px-4">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] transition-colors ${
              isActive
                ? "bg-gradient-to-r from-blush-500 to-blush-600 font-semibold text-white shadow-soft"
                : "font-medium text-ink/80 hover:bg-white/60 hover:text-ink"
            }`
          }
        >
          <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 px-5 pb-2 pt-6">
        <div className="rounded-2xl bg-white/70 p-2 shadow-soft">
          <Heart className="h-7 w-7 fill-blush-500 text-blush-600" />
        </div>
        <div>
          <div className="text-[19px] font-bold leading-6 text-blush-700">
            Commitment
            <br />
            Tracker
          </div>
          <div className="mt-1 text-[11px] font-medium text-blush-500">
            Plan Today, Brighter Tomorrow ♡
          </div>
        </div>
      </div>
      <div className="mt-5 flex-1 overflow-y-auto">
        <NavItems onNavigate={onNavigate} />
      </div>
      <div className="mx-4 mb-4 rounded-2xl bg-white/60 p-4 shadow-soft">
        <div className="flex items-end gap-2">
          <Flower2 className="h-8 w-8 shrink-0 text-blush-400" strokeWidth={1.5} />
          <p className="text-[12px] italic leading-4 text-blush-600">
            Small steps today, bigger dreams tomorrow ♡
          </p>
        </div>
        <div className="mt-1 text-right">
          <Sparkles className="ml-auto h-3.5 w-3.5 text-blush-300" />
        </div>
      </div>
      <div className="px-5 pb-3 text-[10px] text-mauve/60">v1.1.0</div>
    </div>
  );
}



export function TopHeader() {
  const [month, setMonth] = useMonthParam();
  const [pickerOpen, setPickerOpen] = useState(false);
  const settings = useAppSettings();
  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const name = settings.data?.display_name || "Profile";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="rounded-full bg-white p-2.5 text-mauve shadow-soft transition-colors hover:text-blush-600 dark:bg-base-300"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <MonthPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          month={month}
          onChange={setMonth}
          trigger={
            <button
              className="flex items-center gap-2 rounded-xl px-2 py-1 text-[24px] font-bold text-ink transition-colors hover:bg-white/70 dark:hover:bg-base-300"
              aria-label="Choose month"
            >
              {formatMonthLong(month)}
              <ChevronDown className="h-5 w-5 text-mauve" />
            </button>
          }
        />
        <button
          aria-label="Next month"
          onClick={() => shift(1)}
          className="rounded-full bg-white p-2.5 text-mauve shadow-soft transition-colors hover:text-blush-600 dark:bg-base-300"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-4">
  
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/70 dark:hover:bg-base-300">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blush-500 text-[15px] font-semibold text-white">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-[15px] font-semibold text-ink">{name}</span>
              <ChevronDown className="h-4 w-4 text-mauve" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem asChild>
              <NavLink to="/settings" className="cursor-pointer">
                <Settings className="h-4 w-4" /> Settings
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-error focus:text-error"
              onClick={() => {
                setToken(null);
                toast.success("Logged out");
                window.location.reload();
              }}
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-blush-50 dark:bg-base-200">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] bg-gradient-to-b from-blush-100 via-blush-150 to-blush-200 lg:block dark:from-base-300 dark:via-base-300 dark:to-base-300">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-blush-100/90 px-4 py-3 backdrop-blur lg:hidden dark:bg-base-300/90">
        <button
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="rounded-xl bg-white p-2 text-ink shadow-soft dark:bg-base-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Heart className="h-5 w-5 fill-blush-500 text-blush-600" />
        <span className="text-[16px] font-bold text-blush-700">
          {NAV.find((n) => pathname.startsWith(n.to))?.label ?? "Commitment Tracker"}
        </span>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-gradient-to-b from-blush-100 via-blush-150 to-blush-200 shadow-xl dark:from-base-300 dark:via-base-300 dark:to-base-300">
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-ink/60 hover:bg-white/60"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="px-4 py-5 lg:ml-[248px] lg:px-7 lg:py-6">
        <TopHeader />
        <div className="mt-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
