// src/app/(platform)/super-admin/_components/insigne.tsx
// Insigne și schelete refolosite în listă și în fișa organizației.
// Culoare ȘI cuvânt, niciodată doar culoare: verde/roșu e exact perechea pe
// care n-o disting cei cu daltonism. Punctul ajută scanarea, textul poartă
// informația. Fundalul tonat detașează insigna de rândul tabelului.
const ETICHETE_STATUS = {
  pending: { text: "În așteptare", clasa: "text-warning bg-warning/10 border-warning/25" },
  active: { text: "Activă", clasa: "text-success bg-success/10 border-success/25" },
  suspended: { text: "Suspendată", clasa: "text-danger bg-danger/10 border-danger/25" },
  archived: { text: "Arhivată", clasa: "text-muted-foreground bg-surface border-border" },
} as const;

const ETICHETE_PLAN = {
  trial: "Perioadă de probă",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
} as const;

export type StatusOrganizatie = keyof typeof ETICHETE_STATUS;
export type PlanOrganizatie = keyof typeof ETICHETE_PLAN;

export function InsignaStatus({ status }: { status: StatusOrganizatie }) {
  const { text, clasa } = ETICHETE_STATUS[status];
  return (
    <span
      className={`text-nota inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold whitespace-nowrap ${clasa}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

export function InsignaPlan({ plan }: { plan: PlanOrganizatie }) {
  return (
    <span className="bg-surface text-muted-foreground rounded-control text-nota px-2 py-0.5">
      {ETICHETE_PLAN[plan]}
    </span>
  );
}

export function Schelet({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`bg-surface rounded-control block animate-pulse ${className}`}
    />
  );
}
