// src/app/(app)/ticketing/nou/formular-tichet.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TIPURI_TICHET, type TipTichet } from "@/domain/ticketing/stari";
import type { ObiectAlocat } from "@/lib/queries/ticketing";
import { DESCRIERI_TIP, ETICHETE_TIP } from "../etichete";
import { creeazaTichet } from "../actions";

const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const CLASA_ETICHETA = "block text-sm font-medium text-foreground";

function Eroare({ mesaj }: Readonly<{ mesaj: string | undefined }>) {
  if (mesaj === undefined) return null;
  return (
    <p role="alert" className="text-danger mt-1 text-xs">
      {mesaj}
    </p>
  );
}

/**
 * Un formular per tip, nu unul generic cu câmpuri ascunse. Tipul se alege
 * întâi, ca un pas separat: e singura decizie care schimbă tot restul, iar
 * amestecarea ei printre câmpuri ar face-o să pară o opțiune oarecare.
 */
/**
 * `prefixCale` există pentru portal: același formular, dar întors în
 * `/portal/tichetele-mele/<id>` în loc de `/ticketing/<id>`. Parametrizare, nu
 * copie: partea grea — alegerea tipului ca pas separat, câmpurile care depind de
 * el, obiectele din primire — ar fi de dublat întreagă, iar două exemplare ale
 * ei ar diverge la prima corectură.
 */
export function FormularTichet({
  obiecteAlocate,
  modulCurent,
  prefixCale = "/ticketing",
}: Readonly<{
  obiecteAlocate: readonly ObiectAlocat[];
  modulCurent: string;
  prefixCale?: string;
}>) {
  const router = useRouter();
  const id = useId();
  const [tip, setTip] = useState<TipTichet | null>(null);
  const [erori, setErori] = useState<Readonly<Record<string, readonly string[]>> | null>(null);
  const [eroareGenerala, setEroareGenerala] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  if (tip === null) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">Ce fel de solicitare deschizi?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIPURI_TICHET.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTip(t)}
              className="border-border hover:border-primary hover:bg-surface rounded-lg border p-4 text-left"
            >
              <span className="text-foreground block font-medium">{ETICHETE_TIP[t]}</span>
              <span className="text-muted-foreground mt-1 block text-sm">{DESCRIERI_TIP[t]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const trimite = (fd: FormData) => {
    setErori(null);
    setEroareGenerala(null);

    // Contextul de diagnostic se citește din browser, nu din formular:
    // angajatul nu trebuie să știe ce e un user agent.
    const context =
      tip === "bug_erp"
        ? {
            url: window.location.href,
            user_agent: navigator.userAgent,
            versiune: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
          }
        : undefined;

    const brut: Record<string, unknown> = { tip };
    for (const [cheie, valoare] of fd.entries()) {
      if (typeof valoare === "string") brut[cheie] = valoare;
    }
    if (tip === "defectiune") brut["blocheaza_activitatea"] = fd.get("blocheaza") === "on";
    if (context !== undefined) brut["context"] = context;

    porneste(async () => {
      const raspuns = await creeazaTichet(brut);
      if (raspuns.ok) {
        router.push(`${prefixCale}/${raspuns.data.id}`);
        return;
      }
      setErori(raspuns.error.fieldErrors ?? null);
      setEroareGenerala(raspuns.error.message);
    });
  };

  const e = (camp: string) => erori?.[camp]?.[0];

  return (
    <form action={trimite} className="space-y-5" noValidate>
      <div className="flex items-center justify-between gap-4">
        <p className="text-foreground text-sm font-medium">{ETICHETE_TIP[tip]}</p>
        <button
          type="button"
          onClick={() => setTip(null)}
          className="text-muted-foreground text-xs underline"
        >
          Schimbă tipul
        </button>
      </div>

      {eroareGenerala !== null && (
        <p
          role="alert"
          className="border-border bg-surface text-danger rounded-md border p-3 text-sm"
        >
          {eroareGenerala}
        </p>
      )}

      <div>
        <label htmlFor={`${id}-titlu`} className={CLASA_ETICHETA}>
          Titlu *
        </label>
        <input id={`${id}-titlu`} name="titlu" className={CLASA_CAMP} maxLength={200} />
        <Eroare mesaj={e("titlu")} />
      </div>

      {tip === "software" && (
        <>
          <div>
            <label htmlFor={`${id}-aplicatie`} className={CLASA_ETICHETA}>
              Ce aplicație *
            </label>
            <input
              id={`${id}-aplicatie`}
              name="aplicatie"
              placeholder="Adobe Photoshop"
              className={CLASA_CAMP}
            />
            <Eroare mesaj={e("aplicatie")} />
          </div>
          <div>
            <label htmlFor={`${id}-licente`} className={CLASA_ETICHETA}>
              Număr de licențe *
            </label>
            <input
              id={`${id}-licente`}
              name="numar_licente"
              type="number"
              min={1}
              defaultValue={1}
              className={CLASA_CAMP}
            />
            <Eroare mesaj={e("numar_licente")} />
          </div>
          <div>
            <label htmlFor={`${id}-motiv`} className={CLASA_ETICHETA}>
              De ce îți este necesară
            </label>
            <textarea id={`${id}-motiv`} name="motiv_necesitate" rows={2} className={CLASA_CAMP} />
          </div>
        </>
      )}

      {tip === "hardware" && (
        <>
          <div>
            <label htmlFor={`${id}-hw`} className={CLASA_ETICHETA}>
              Ce echipament *
            </label>
            <input
              id={`${id}-hw`}
              name="denumire_hardware"
              placeholder="Monitor 27 inch"
              className={CLASA_CAMP}
            />
            <Eroare mesaj={e("denumire_hardware")} />
          </div>
          <div>
            <label htmlFor={`${id}-livrare`} className={CLASA_ETICHETA}>
              Unde se livrează *
            </label>
            <select id={`${id}-livrare`} name="loc_livrare" className={CLASA_CAMP}>
              <option value="birou">La birou</option>
              <option value="domiciliu">La domiciliu</option>
            </select>
            <Eroare mesaj={e("loc_livrare")} />
          </div>
          <div>
            <label htmlFor={`${id}-adresa`} className={CLASA_ETICHETA}>
              Adresa de livrare
            </label>
            <input id={`${id}-adresa`} name="adresa_livrare" className={CLASA_CAMP} />
            <p className="text-muted-foreground mt-1 text-xs">
              Obligatorie doar dacă echipamentul se livrează la domiciliu.
            </p>
            <Eroare mesaj={e("adresa_livrare")} />
          </div>
        </>
      )}

      {tip === "defectiune" && (
        <>
          <div>
            <label htmlFor={`${id}-obiect`} className={CLASA_ETICHETA}>
              Ce s-a stricat *
            </label>
            {obiecteAlocate.length === 0 ? (
              <p className="border-border text-muted-foreground mt-1 rounded-md border border-dashed p-3 text-sm">
                Nu ai niciun obiect de inventar în primire. Dacă ceva ți-a fost dat și nu apare
                aici, cere-i administratorului să-l înregistreze în inventar întâi.
              </p>
            ) : (
              <select id={`${id}-obiect`} name="inventory_item_id" className={CLASA_CAMP}>
                <option value="">— Alege —</option>
                {obiecteAlocate.map((obiect) => (
                  <option key={obiect.id} value={obiect.id}>
                    {obiect.denumire}
                    {obiect.numar_inventar === null ? "" : ` · ${obiect.numar_inventar}`}
                    {obiect.serie === null ? "" : ` · seria ${obiect.serie}`}
                  </option>
                ))}
              </select>
            )}
            <Eroare mesaj={e("inventory_item_id")} />
          </div>
          <div className="flex items-center gap-2">
            <input id={`${id}-blocheaza`} name="blocheaza" type="checkbox" className="size-4" />
            <label htmlFor={`${id}-blocheaza`} className="text-foreground text-sm">
              Nu îmi pot face treaba din cauza asta
            </label>
          </div>
          <div>
            <label htmlFor={`${id}-locatie`} className={CLASA_ETICHETA}>
              Unde se află echipamentul
            </label>
            <input
              id={`${id}-locatie`}
              name="locatie"
              placeholder="Etaj 2, birou 12"
              className={CLASA_CAMP}
            />
          </div>
        </>
      )}

      {tip === "bug_erp" && (
        <>
          <div>
            <label htmlFor={`${id}-modul`} className={CLASA_ETICHETA}>
              Unde s-a întâmplat *
            </label>
            <input
              id={`${id}-modul`}
              name="modul"
              defaultValue={modulCurent}
              className={CLASA_CAMP}
            />
            <Eroare mesaj={e("modul")} />
          </div>
          <div>
            <label htmlFor={`${id}-pasi`} className={CLASA_ETICHETA}>
              Ce ai făcut *
            </label>
            <textarea id={`${id}-pasi`} name="pasi_efectuati" rows={3} className={CLASA_CAMP} />
            <Eroare mesaj={e("pasi_efectuati")} />
          </div>
          <div>
            <label htmlFor={`${id}-asteptat`} className={CLASA_ETICHETA}>
              Ce te așteptai să se întâmple *
            </label>
            <textarea
              id={`${id}-asteptat`}
              name="rezultat_asteptat"
              rows={2}
              className={CLASA_CAMP}
            />
            <Eroare mesaj={e("rezultat_asteptat")} />
          </div>
          <div>
            <label htmlFor={`${id}-obtinut`} className={CLASA_ETICHETA}>
              Ce s-a întâmplat de fapt *
            </label>
            <textarea
              id={`${id}-obtinut`}
              name="rezultat_obtinut"
              rows={2}
              className={CLASA_CAMP}
            />
            <Eroare mesaj={e("rezultat_obtinut")} />
          </div>
        </>
      )}

      <div>
        <label htmlFor={`${id}-descriere`} className={CLASA_ETICHETA}>
          Detalii *
        </label>
        <textarea id={`${id}-descriere`} name="descriere" rows={4} className={CLASA_CAMP} />
        <Eroare mesaj={e("descriere")} />
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {inCurs ? "Se trimite…" : "Trimite tichetul"}
      </button>
    </form>
  );
}
