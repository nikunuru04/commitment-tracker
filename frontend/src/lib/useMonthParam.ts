import { useSearchParams } from "react-router-dom";
import { currentMonth, isValidMonth } from "./format";

/** Shared per-page month selector state stored in URL `?month=YYYY-MM`. */
export function useMonthParam(): [string, (m: string) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("month") ?? "";
  const month = isValidMonth(raw) ? raw : currentMonth();
  return [
    month,
    (m) => {
      const next = new URLSearchParams(params);
      next.set("month", m);
      setParams(next, { replace: true });
    },
  ];
}
