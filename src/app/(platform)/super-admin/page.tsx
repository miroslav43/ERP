import Link from "next/link";

import { Cifra } from "./_components/cifra";
import { Sarcina } from "./_components/sarcina";
import { datePanou } from "./organizatii/actions";

export const metadata = { title: "Panou de platformă" };

/** Acțiunile din `audit_logs` sunt chei tehnice; aici le dăm nume de oameni. */
const ETICHETE_ACTIUNE: Readonly<Record<string, string>> = {
  feature_toggled: "Modul comutat",
  invite_sent: "Invitație trimisă",
  invite_revoked: "Invitație anulată",
  role_changed: "Rol schimbat",
  update: "Modificare",
};

export default async function PaginaPanouPlatforma() {
  const { sumar, sarcini, activitate } = await datePanou();
  const { pending, active, suspended } = sumar.organizatii;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-foreground text-2xl font-semibold">Panou de platformă</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Firme, module și înregistrări. Operarea fiecărei firme se face din contul ei.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra eticheta="Active" valoare={active} ton={active > 0 ? "bun" : "neutru"} />
        <Cifra eticheta="În așteptare" valoare={pending} />
        <Cifra eticheta="Suspendate" valoare={suspended} />
        <Cifra
          eticheta="Cereri noi"
          valoare={sumar.cereriDemoNoi}
          ton={sumar.cereriDemoNoi > 0 ? "atentie" : "neutru"}
        />
      </dl>

      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="border-border bg-surface overflow-hidden rounded-lg border">
          <h2 className="border-border bg-background border-b px-4 py-2.5 text-sm font-semibold">
            De rezolvat
          </h2>
          {sarcini.length > 0 ? (
            <ul>
              {sarcini.map((s) => (
                <Sarcina
                  key={`${s.cheie}-${s.href}`}
                  titlu={s.titlu}
                  detaliu={s.detaliu}
                  href={s.href}
                  eticheta={s.eticheta}
                  urgent={s.urgent}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              Nimic de rezolvat. Panoul se golește când totul e în regulă.
            </p>
          )}
        </section>

        <section className="border-border bg-surface overflow-hidden rounded-lg border">
          <h2 className="border-border bg-background border-b px-4 py-2.5 text-sm font-semibold">
            Ce s-a schimbat
          </h2>
          {activitate.length > 0 ? (
            <ul>
              {activitate.map((intrare) => (
                <li
                  key={intrare.id}
                  className="border-border grid grid-cols-[3.5rem_1fr] gap-3 border-b px-4 py-2.5 last:border-b-0"
                >
                  <time
                    dateTime={intrare.created_at}
                    className="text-muted-foreground font-mono text-xs"
                  >
                    {new Date(intrare.created_at).toLocaleDateString("ro-RO", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </time>
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold">
                      {ETICHETE_ACTIUNE[intrare.action] ?? intrare.action}
                    </span>
                    <span className="text-muted-foreground"> · {intrare.entity_type}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              Nicio activitate înregistrată încă.
            </p>
          )}
          <div className="border-border border-t px-4 py-2.5">
            <Link
              href="/super-admin/jurnal-audit"
              className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
            >
              Vezi jurnalul complet
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
