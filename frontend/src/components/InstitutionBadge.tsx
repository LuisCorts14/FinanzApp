// Círculo con las iniciales de la institución en su color de marca (en vez de logos oficiales).
function initials(name: string): string {
  let words = name.split(/\s+/).filter((w) => w && !["de", "del"].includes(w.toLowerCase()));
  // "BancoEstado" -> ["Banco", "Estado"]
  if (words.length === 1) words = words[0].match(/[A-ZÁÉÍÓÚ][a-záéíóú]+/g) ?? words;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface InstitutionBadgeProps {
  name: string;
  color?: string;
  size?: "sm" | "md";
}

export default function InstitutionBadge({ name, color, size = "md" }: InstitutionBadgeProps) {
  return (
    <span
      className={`institution-badge institution-badge-${size}`}
      style={{ background: color ?? "var(--text-muted)" }}
    >
      {initials(name)}
    </span>
  );
}
