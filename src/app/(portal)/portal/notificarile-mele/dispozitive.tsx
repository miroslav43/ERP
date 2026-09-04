// src/app/(portal)/portal/notificarile-mele/dispozitive.tsx
import { BellOff, Smartphone } from "lucide-react";

import { formatDateTime } from "@/lib/format/date";
import { ButonTrimite } from "@/components/incarcare/buton-trimite";
import type { ServerSupabase } from "@/lib/supabase/server";

import { trimiteComutarePush, trimiteRetragereDispozitiv } from "./actions";

const ETICHETE_PLATFORMA: Readonly<Record<string, string>> = {
  android: "Android",
  ios: "iPhone",
};

/**
 * Notificările pe telefon: comutatorul durabil și telefoanele înregistrate.
 *
 * ── DE CE EXISTĂ SECȚIUNEA ────────────────────────────────────────────────
 * Aplicația mobilă își înregistrează jetonul SINGURĂ, la prima deschidere,
 * imediat după ce omul acceptă cererea sistemului. Până la 2026-09-04 nu exista
 * niciun drum înapoi: `DELETE /api/dispozitive` era scrisă, testată și fără
 * niciun apelant, iar `notification_preferences.push` — coloana pe care
 * triggerul chiar o citește (`0122:146-152`) — n-avea niciun scriitor. Un
 * consimțământ care nu se poate retrage nu e consimțământ.
 *
 * ── DE CE DOUĂ CONTROALE, ȘI DE CE ÎN ORDINEA ASTA ────────────────────────
 * Comutatorul e primul fiindcă e singurul care REZISTĂ. `inregistrat` din
 * `mobil/App.tsx:302` e un `useRef`, deci se pierde la fiecare pornire a
 * aplicației și telefonul se reînregistrează — retragerea unui dispozitiv ține
 * exact până la următoarea deschidere. Ea rămâne totuși utilă, și pentru altă
 * întrebare: „telefonul ăla nu mai e al meu".
 *
 * Secțiunea trăiește în cutia poștală, nu într-un ecran de setări separat:
 * acolo ajunge omul când se întreabă ceva despre notificări, iar un ecran în
 * plus pe care nu-l găsește nimeni nu e o cale de ieșire.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu oferă comutatoare pe FELUL notificării, deși `notification_preferences` e
 * indexată pe `kind`. Comutatorul de aici scrie toate cele opt feluri deodată.
 * Matricea feluri × canale (`in_app`, `email`, `push`) e un ecran de sine
 * stătător — n-are azi interfață nici în aplicația mare — iar „oprește-le pe
 * telefon" e controlul de care omul are nevoie ACUM, fără el.
 */
export async function Dispozitive({
  db,
  userId,
  organizationId,
}: Readonly<{ db: ServerSupabase; userId: string; organizationId: string }>) {
  // Filtrele pe `user_id` și `organization_id` sunt explicite deși RLS le
  // impune — aceeași grijă ca în restul proiectului.
  const [dispozitive, preferinte] = await Promise.all([
    db
      .from("dispozitive_push")
      .select("id, platforma, vazut_la")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("vazut_la", { ascending: false }),
    db
      .from("notification_preferences")
      .select("push")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
  ]);

  // O citire picată nu are voie să ia cu ea cutia poștală: secțiunea dispare,
  // notificările rămân. Ecranul principal al paginii e lista de mesaje.
  if (dispozitive.error !== null || preferinte.error !== null) return null;

  const telefoane = dispozitive.data ?? [];
  const randuri = preferinte.data ?? [];

  // Fără niciun rând, implicitul e PORNIT — exact ce face `coalesce(..., true)`
  // din trigger. Cu rânduri, e oprit doar dacă TOATE spun `false`: o stare
  // amestecată (scrisă cândva de un ecran care nu există încă) nu are voie să
  // arate „oprit" cât timp o parte din notificări încă pleacă.
  const pornit = randuri.length === 0 || randuri.some((r) => r.push);

  // Nimic de arătat: niciun telefon înregistrat și notificările pornite din
  // implicit. Secțiunea ar fi un comutator pentru ceva ce nu se întâmplă.
  if (telefoane.length === 0 && pornit) return null;

  return (
    <section className="border-border bg-surface rounded-panou border p-4">
      <h2 className="text-text flex items-center gap-2 text-sm font-medium">
        {pornit ? (
          <Smartphone aria-hidden className="size-4" />
        ) : (
          <BellOff aria-hidden className="size-4" />
        )}
        Notificări pe telefon
      </h2>
      <p className="text-text-secundar mt-1 text-sm">
        {pornit
          ? "Primiți notificări în aplicația de telefon."
          : "Notificările pe telefon sunt oprite. Mesajele rămân aici, în cutia poștală."}
      </p>

      <form action={trimiteComutarePush} className="mt-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="pornit" value={pornit ? "0" : "1"} />
        <ButonTrimite
          varianta={pornit ? "secundar" : "primar"}
          textInCurs={pornit ? "Se oprește…" : "Se pornește…"}
        >
          {pornit ? "Oprește notificările pe telefon" : "Pornește notificările pe telefon"}
        </ButonTrimite>
      </form>

      {telefoane.length > 0 && (
        <>
          <h3 className="text-text mt-5 text-sm font-medium">Telefoane înregistrate</h3>
          <ul className="divide-border mt-1 divide-y">
            {telefoane.map((telefon) => (
              <li key={telefon.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-text-secundar text-sm">
                  {ETICHETE_PLATFORMA[telefon.platforma] ?? telefon.platforma}
                  {" · văzut "}
                  {formatDateTime(telefon.vazut_la)}
                </span>
                <form action={trimiteRetragereDispozitiv}>
                  <input type="hidden" name="id" value={telefon.id} />
                  <ButonTrimite varianta="secundar" textInCurs="Se retrage…">
                    Retrage
                  </ButonTrimite>
                </form>
              </li>
            ))}
          </ul>
          <p className="text-text-secundar mt-3 text-xs">
            Retragerea ține până la următoarea deschidere a aplicației pe telefonul acela —
            aplicația se reînregistrează la pornire. Pentru un „nu” care rezistă, folosiți
            comutatorul de mai sus.
          </p>
        </>
      )}
    </section>
  );
}
