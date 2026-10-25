import type { Pace } from "../utils/savings";
import { formatCLP } from "../utils/format";

const LABELS: Record<Pace["kind"], { icon: string; className: string }> = {
  achieved: { icon: "✓", className: "pace-good" },
  ahead: { icon: "↑", className: "pace-good" },
  on_track: { icon: "✓", className: "pace-good" },
  behind: { icon: "!", className: "pace-warning" },
  expired: { icon: "!", className: "pace-critical" },
};

function paceText(pace: Pace): string {
  switch (pace.kind) {
    case "achieved":
      return "¡Meta cumplida!";
    case "expired":
      return "La fecha objetivo ya pasó";
    case "on_track":
      return "Vas al día";
    case "ahead":
      return `Vas adelantado ${formatCLP(pace.diff)}`;
    case "behind":
      return `Vas atrasado ${formatCLP(pace.diff)}`;
  }
}

// Estado del ritmo con ícono + texto (nunca solo color).
export default function PaceBadge({ pace }: { pace: Pace }) {
  const { icon, className } = LABELS[pace.kind];
  return (
    <span className={`pace-badge ${className}`}>
      <span className="pace-icon" aria-hidden="true">
        {icon}
      </span>
      {paceText(pace)}
    </span>
  );
}
