// src/app/(platform)/super-admin/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";
import { NavigatiePlatforma } from "./_components/nav-platforma";

export default async function LayoutSuperAdmin({ children }: { children: ReactNode }) {
  // Poarta principală: nimic din acest segment nu se randează fără verificare server-side.
  const utilizator = await requirePlatformAdmin();

  return (
    <div className="bg-background text-foreground min-h-dvh">
      {/* Marcaj vizual permanent: nu ești în shell-ul unei organizații. */}
      <div className="border-border bg-surface border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="border-border text-warning inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm font-semibold">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Panou de platformă
          </span>
          <p className="text-muted-foreground text-sm">
            Administrați toate organizațiile. Acțiunile de aici sunt înregistrate în jurnalul de
            audit.
          </p>
          <div className="ms-auto flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{utilizator.email}</span>
            <Link
              href={RUTA_DUPA_AUTENTIFICARE}
              className="text-primary focus-visible:ring-ring rounded-md px-2 py-1 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Înapoi în aplicație
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
        <NavigatiePlatforma />
        <main id="continut" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
