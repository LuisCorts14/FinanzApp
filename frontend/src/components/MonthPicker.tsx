import { useMemo } from "react";
import { getCurrentMonthKey, monthName, shiftMonth } from "../utils/month";

const MONTH_OPTIONS = 12;

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
}

// Selector de los últimos 12 meses, con el estilo de la barra de acciones de cada página.
export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const options = useMemo(() => {
    const current = getCurrentMonthKey();
    return Array.from({ length: MONTH_OPTIONS }, (_, i) => shiftMonth(current, -i));
  }, []);

  return (
    <label className="month-select">
      <span>Mes</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((m) => (
          <option key={m} value={m}>
            {monthName(m, true)}
          </option>
        ))}
      </select>
    </label>
  );
}
