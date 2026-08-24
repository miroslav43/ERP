// src/app/(app)/ssm/dosarul-meu.tsx
import { treaptaSsm } from "@/domain/ssm/scadente";
import { GraduationCap, HardHat, Stethoscope } from "lucide-react";

import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { Scadenta } from "@/components/ui/scadenta";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  autorizatiiNominale,
  eip,
  fiseAptitudine,
  instruirileMele,
  restrictiiActive,
} from "@/lib/queries/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import { nomenclatorInstruiri } from "./actions";
import {
  ETICHETE_DOMENIU,
  ETICHETE_REZULTAT_EXAMEN,
  ETICHETE_SCADENTA,
  TONURI_REZULTAT_EXAMEN,
} from "./etichete";

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
  const [instruiri, fise, restrictii, echipamente, autorizatii, tipuriRezultat] = await Promise.all(
    [
      instruirileMele(organizationId),
      fiseAptitudine(organizationId, { rezultat: null, cursor: null, limita: 100, sort: null }),
      restrictiiActive(organizationId),
      eip(organizationId, { cursor: null, limita: 100, sort: null }),
      autorizatiiNominale(organizationId),
      nomenclatorInstruiri({}),
    ],
  );

  const tipuri = tipuriRezultat.ok ? tipuriRezultat.data : [];
  const denumireTip = new Map(tipuri.map((t) => [t.id, t]));
  const azi = todayInBucharest();

  /**
   * `instruirileMele` citește tot dosarul propriu, fără cursor — deci tabelul
   * n-are nici sortare, nici paginare, doar căderea pe card sub 768px.
   */
  const coloaneInstruiri: readonly Coloana<(typeof instruiri)[number]>[] = [
    {
      cheie: "domeniu",
      antet: "Domeniu",
      peTelefon: "meta",
      latime: "ingusta",
      celula: (i) => {
        const tip = denumireTip.get(i.training_type_id);
        return tip === undefined ? "—" : ETICHETE_DOMENIU[tip.domeniu];
      },
    },
    {
      cheie: "tip",
      antet: "Tip instruire",
      peTelefon: "titlu",
      celula: (i) => denumireTip.get(i.training_type_id)?.denumire ?? "—",
    },
    {
      cheie: "data",
      antet: "Data",
      peTelefon: "meta",
      latime: "ingusta",
      celula: (i) => formatDate(i.data_instruirii),
    },
    {
      cheie: "scadenta",
      antet: "Scadență",
      peTelefon: "meta",
      celula: (i) => {
        // Fără termen de reînnoire nu e o problemă de rezolvat, deci treapta e
        // `neaplicabil` — pastilă fără niciun semnal de alarmă, exact ca textul
        // stins de până acum.
        if (i.urmatoarea_scadenta === null) {
          return <Scadenta treapta="neaplicabil">fără scadență</Scadenta>;
        }
        const stare = stareScadentaSsm(true, i.urmatoarea_scadenta, azi);
        return (
          <>
            <Scadenta treapta={treaptaSsm(stare, i.urmatoarea_scadenta)}>
              {ETICHETE_SCADENTA[stare]}
            </Scadenta>{" "}
            <span className="text-muted-foreground">{formatDate(i.urmatoarea_scadenta)}</span>
          </>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <AntetPagina
        titlu="Dosarul meu SSM/PSI"
        descriere="Instruirile, fișa de aptitudine și echipamentul dumneavoastră. Pentru completări sau corecturi, contactați responsabilul SSM al organizației."
      />

      <section aria-labelledby="instruiri-proprii" className="space-y-3">
        <h2 id="instruiri-proprii" className="text-sectiune font-semibold">
          Instruiri efectuate
        </h2>
        {instruiri.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={GraduationCap}
            titlu="Nu aveți nicio instruire înregistrată"
            descriere="Anunțați responsabilul SSM al organizației."
            compact
          />
        ) : (
          <Tabel
            caption="Instruirile SSM/PSI pe care le-ați efectuat."
            coloane={coloaneInstruiri}
            randuri={instruiri}
            cheieRand={(i) => i.id}
            gol={null}
          />
        )}
      </section>

      <section aria-labelledby="fisa-proprie" className="space-y-3">
        <h2 id="fisa-proprie" className="text-sectiune font-semibold">
          Fișă de aptitudine
        </h2>
        {fise.randuri.length === 0 ? (
          <StareGoala
            compact
            fel="initiala"
            pictograma={Stethoscope}
            titlu="Nicio fișă de aptitudine înregistrată"
            descriere="Anunțați responsabilul SSM al organizației."
          />
        ) : (
          <ul className="space-y-2">
            {fise.randuri.map((f) => (
              <li
                key={f.id}
                className="border-border rounded-panou text-corp flex flex-wrap items-center justify-between gap-2 border p-3"
              >
                <span>
                  {formatDate(f.data_examinarii)}
                  {f.valabil_pana === null
                    ? null
                    : ` · valabilă până la ${formatDate(f.valabil_pana)}`}
                </span>
                <Badge ton={TONURI_REZULTAT_EXAMEN[f.rezultat]}>
                  {ETICHETE_REZULTAT_EXAMEN[f.rezultat]}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {restrictii.length === 0 ? null : (
          <div
            role="alert"
            className="border-warning/40 bg-warning/12 rounded-panou text-corp border p-4"
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
        <h2 id="eip-propriu" className="text-sectiune font-semibold">
          Echipament individual de protecție
        </h2>
        {echipamente.randuri.length === 0 ? (
          <StareGoala
            compact
            fel="initiala"
            pictograma={HardHat}
            titlu="Niciun echipament predat"
            descriere="Anunțați responsabilul SSM al organizației."
          />
        ) : (
          <ul className="space-y-2">
            {echipamente.randuri.map((e) => (
              <li
                key={e.id}
                className="border-border rounded-panou text-corp flex flex-wrap items-center justify-between gap-2 border p-3"
              >
                <span>
                  {e.articol} ({e.cantitate} {e.unitate})
                </span>
                <span className="text-muted-foreground">
                  predat {formatDate(e.data_predarii)}
                  {e.data_inlocuirii === null
                    ? ""
                    : ` · înlocuire până la ${formatDate(e.data_inlocuirii)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {autorizatii.length === 0 ? null : (
        <section aria-labelledby="autorizatii-proprii" className="space-y-3">
          <h2 id="autorizatii-proprii" className="text-sectiune font-semibold">
            Autorizații nominale
          </h2>
          <ul className="space-y-2">
            {autorizatii.map((a) => (
              <li
                key={a.id}
                className="border-border rounded-panou text-corp flex flex-wrap items-center justify-between gap-2 border p-3"
              >
                <span>
                  {a.tip} · nr. {a.numar}
                </span>
                <span className="text-muted-foreground">
                  valabilă până la {formatDate(a.valabil_pana)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
