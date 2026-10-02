/**
 * Conturile demonstrative folosite de testele de capăt la capăt.
 *
 * Sursa: `CONTURI` din `scripts/demo/seed-demo.mjs`. Ierarhia din seed:
 * DEMO-004 (Ioana Georgescu, `employee`) are șef pe DEMO-003 (Radu Pop,
 * `manager`) — pe asta se sprijină fluxul de aprobare din `concediu.spec.ts`.
 */
export const ROLURI = ["org_admin", "hr", "manager", "employee"] as const;
export type Rol = (typeof ROLURI)[number];

export const CONTURI: Readonly<Record<Rol, { email: string; acasa: string; nume: string }>> = {
  org_admin: { email: "demo_orgadmin@gmail.com", acasa: "/panou", nume: "Ana Ionescu" },
  hr: { email: "demo_hr@gmail.com", acasa: "/panou", nume: "Elena Marin" },
  manager: { email: "demo_manager@gmail.com", acasa: "/panou", nume: "Radu Pop" },
  // `rutaDupaAutentificare` (src/config/routes.ts) trimite angajatul în portal.
  employee: { email: "demo_employee@gmail.com", acasa: "/portal", nume: "Ioana Georgescu" },
};

export function caleStare(rol: Rol): string {
  return `e2e/.auth/${rol}.json`;
}
