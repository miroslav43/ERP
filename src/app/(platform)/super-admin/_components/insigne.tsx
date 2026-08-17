// src/app/(platform)/super-admin/_components/insigne.tsx
// Insigne și schelete refolosite în listă și în fișa organizației.
const ETICHETE_STATUS = {
  pending: { text: "În așteptare", clasa: "text-warning" },
  active: { text: "Activă", clasa: "text-success" },
  suspended: { text: "Suspendată", clasa: "text-danger" },
  archived: { text: "Arhivată", clasa: "text-muted-foreground" },
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
      className={`border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${clasa}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

export function InsignaPlan({ plan }: { plan: PlanOrganizatie }) {
  return (
    <span className="bg-surface text-muted-foreground rounded-md px-2 py-0.5 text-xs">
      {ETICHETE_PLAN[plan]}
    </span>
  );
}

export function Schelet({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`bg-surface block animate-pulse rounded-md ${className}`} />
  );
}
