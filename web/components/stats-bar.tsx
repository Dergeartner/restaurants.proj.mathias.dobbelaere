import type { Restaurant } from "@/app/types";

type Props = {
  restaurants: Restaurant[];
  lieferandoPartners: number;
};

export function StatsBar({ restaurants, lieferandoPartners }: Props) {
  const total = restaurants.length;
  const withWebsite = restaurants.filter((r) => r.hat_website).length;
  const hot = restaurants.filter((r) => r.lead_score === 3).length;
  const akquise = restaurants.filter(
    (r) => !r.auf_lieferando && r.lead_score >= 2,
  ).length;
  const penetration = total > 0 ? (lieferandoPartners / total) * 100 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        label="Gastronomische Betriebe"
        value={total.toLocaleString("de-DE")}
        sub="aus OpenStreetMap"
      />
      <Card
        label="Mit Website"
        value={`${withWebsite}`}
        sub={`${total > 0 ? ((100 * withWebsite) / total).toFixed(1) : "0"} %`}
      />
      <Card
        label="Hot Leads"
        value={`${hot}`}
        sub="Website + Telefon"
        accent
      />
      <Card
        label="Lieferando-Marktdurchdringung"
        value={`${penetration.toFixed(1)} %`}
        sub={`${lieferandoPartners} von ${total} – ${akquise} Akquise-Kandidaten`}
        warn
      />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const valueColor = accent
    ? "text-lieferando"
    : warn
      ? "text-amber-700"
      : "text-neutral-900";
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}
