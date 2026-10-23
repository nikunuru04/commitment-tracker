import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth } from "../../lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { cn } from "../../lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthPickerProps {
  month: string; // YYYY-MM
  onChange: (month: string) => void;
  /** Controlled open state (optional; unmanaged when omitted). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Custom trigger node (optional; default is a bordered button with the month label). */
  trigger?: React.ReactNode;
  triggerClassName?: string;
}

export function MonthPicker({ month, onChange, open, onOpenChange, trigger, triggerClassName }: MonthPickerProps) {
  const [year, stateMonth] = month.split("-").map(Number);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setIsOpen = onOpenChange ?? setUncontrolledOpen;

  function pick(m: number) {
    onChange(`${year}-${String(m + 1).padStart(2, "0")}`);
    setIsOpen(false);
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className={cn("font-normal", triggerClassName)}>
            {formatMonth(month)}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous year"
            onClick={() => onChange(`${year - 1}-${String(stateMonth).padStart(2, "0")}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold">{year}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next year"
            onClick={() => onChange(`${year + 1}-${String(stateMonth).padStart(2, "0")}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((label, i) => {
            const selected = i + 1 === stateMonth;
            return (
              <button
                key={label}
                type="button"
                onClick={() => pick(i)}
                className={cn(
                  "rounded-xl py-2 text-sm",
                  selected ? "bg-primary text-primary-content font-medium" : "hover:bg-base-300",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
