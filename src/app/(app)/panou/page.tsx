// src/app/(app)/page.tsx
import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

export const metadata: Metadata = { title: "Panou de control" };

export default async function PaginaPanou() {
  const rezolvare = await resolveTenant();
  const nume = rezolvare.status === "ok" ? (rezolvare.user.fullName ?? rezolvare.user.email) : "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-primary text-2xl font-semibold">Panou de control</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bine ați venit{nume === "" ? "" : `, ${nume}`}. Astăzi este{" "}
          {formatDate(todayInBucharest())}.
        </p>
      </div>

      <EmptyState
        icon={LayoutDashboard}
        title="Niciun modul activ încă"
        description="Modulele activate pentru organizația dvs. vor apărea aici, cu indicatorii lor. Activarea se face de echipa Administrativo, la cerere."
      />
    </div>
  );
}
