// src/app/(app)/ssm/dosarul-meu.tsx
import { GraduationCap } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { autorizatiiNominale, eip, fiseAptitudine, instruirileMele, restrictiiActive } from "@/lib/queries/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import { nomenclatorInstruiri } from "./actions";
import { CLASE_REZULTAT_EXAMEN, CLASE_SCADENTA, ETICHETE_DOMENIU, ETICHETE_REZULTAT_EXAMEN, ETICHETE_SCADENTA } from "./etichete";

/**
 * Dosarul propriu — pentru cine are `ssm:read` doar la scope „own" (tipic
 * rolul `employee`).
 *
 * NU se adaugă niciun filtru după `employee_id` în interogări: RLS
 * (`app.ssm_acces` cu scope „own") restrânge singură rândurile la propria
 * fișă — nici nu s-ar putea altfel, fiindcă `employees:read` e `none` pentru
 * `employee`, deci clientul obișnuit nu poate afla propriul `employee_id`
 * ca să-l filtreze manual.
 */
export async function DosarulMeu({ organizationId }: { readonly organizationId: string }) {
  const [instruiri, fise, restrictii, echipamente, autorizatii, tipuriRezultat] = await Promise.all([
    instruirileMele(organizationId),
    fiseAptitudine(organizationId, { rezultat: null, cursor: null, limita: 100 }),
    restrictiiActive(organizationId),
    eip(organizationId, { cursor: null, limita: 100 }),
    autorizatiiNominale(organizationId),
    nomenclatorInstruiri({}),
  ]);

  const tipuri = tipuriRezultat.ok ? tipuriRezultat.data : [];
  const denumireTip = new Map(tipuri.map((t) => [t.id, t]));
  const azi = todayInBucharest();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Dosarul meu SSM/PSI</h1>
        <p className="text-sm text-muted-foreground">
          Instruirile, fișa de aptitudine și echipamentul dumneavoastră. Pentru completări sau
          corecturi, contactați responsabilul SSM al organizației.
        </p>
      </header>

      <section aria-labelledby="instruiri-proprii" className="space-y-3">
        <h2 id="instruiri-proprii" className="text-lg font-semibold">
          Instruiri efectuate
        </h2>
        {instruiri.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nu aveți nicio instruire înregistrată"
            description="Anunțați responsabilul SSM al organizației."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Domeniu
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tip instruire
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Scadență
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {instruiri.map((i) => {
                  const tip = denumireTip.get(i.training_type_id);
                  const stare = stareScadentaSsm(true, i.urmatoarea_scadenta, azi);
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-3">
                        {tip === undefined ? "—" : ETICHETE_DOMENIU[tip.domeniu]}
                      </td>
                      <td className="px-4 py-3">{tip?.denumire ?? "—"}</td>
                      <td className="px-4 py-3">{formatDate(i.data_instruirii)}</td>
                      <td className="px-4 py-3">
                        {i.urmatoarea_scadenta === null ? (
                          <span className="text-muted-foreground">fără scadență</span>
                        ) : (
                          <>
                            <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_SCADENTA[stare]}`}>
                              {ETICHETE_SCADENTA[stare]}
                            </span>{" "}
                            <span className="text-muted-foreground">{formatDate(i.urmatoarea_scadenta)}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="fisa-proprie" className="space-y-3">
        <h2 id="fisa-proprie" className="text-lg font-semibold">
          Fișă de aptitudine
        </h2>
        {fise.randuri.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nicio fișă de aptitudine înregistrată.</p>
        ) : (
          <ul className="space-y-2">
            {fise.randuri.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span>
                  {formatDate(f.data_examinarii)}
                  {f.valabil_pana === null ? null : ` · valabilă până la ${formatDate(f.valabil_pana)}`}
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_REZULTAT_EXAMEN[f.rezultat]}`}>
                  {ETICHETE_REZULTAT_EXAMEN[f.rezultat]}
                </span>
              </li>
            ))}
          </ul>
        )}

        {restrictii.length === 0 ? null : (
          <div
            role="alert"
            className="rounded-lg border border-warning/40 bg-warning/12 p-4 text-sm"
          >
            <p className="font-medium">Restricții active</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {restrictii.map((r) => (
                <li key={r.id}>{r.restrictie}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="eip-propriu" className="space-y-3">
        <h2 id="eip-propriu" className="text-lg font-semibold">
          Echipament individual de protecție
        </h2>
        {echipamente.randuri.length === 0 ? (
          <p className="text-sm text-muted-foreground">Niciun echipament predat.</p>
        ) : (
          <ul className="space-y-2">
            {echipamente.randuri.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span>
                  {e.articol} ({e.cantitate} {e.unitate})
                </span>
                <span className="text-muted-foreground">
                  predat {formatDate(e.data_predarii)}
                  {e.data_inlocuirii === null ? "" : ` · înlocuire până la ${formatDate(e.data_inlocuirii)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {autorizatii.length === 0 ? null : (
        <section aria-labelledby="autorizatii-proprii" className="space-y-3">
          <h2 id="autorizatii-proprii" className="text-lg font-semibold">
            Autorizații nominale
          </h2>
          <ul className="space-y-2">
            {autorizatii.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span>
                  {a.tip} · nr. {a.numar}
                </span>
                <span className="text-muted-foreground">valabilă până la {formatDate(a.valabil_pana)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
