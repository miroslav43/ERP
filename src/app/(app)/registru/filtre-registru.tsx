"use client";

// src/app/(app)/registru/filtre-registru.tsx

import { useSearchParams } from "next/navigation";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Camp } from "@/components/ui/camp";

import { ETICHETE_SENS, eticheteazaTipDocument } from "./etichete";

const SENSURI = ["intrare", "iesire", "intern"] as const;

type Props = Readonly<{
  ani: readonly number[];
  tipuri: readonly string[];
}>;

/**
 * Filtrele registrului.
 *
 * ── DE CE ANUL E AICI, NU UN TABLIST ────────────────────────────────────────
 * Anul e un filtru ca oricare altul din perspectiva barei, dar e SINGURUL fără
 * variantă „toate": Ordinul 217/1996 art. 9 face din registru un volum pe an,
 * iar „numărul 437" nu înseamnă nimic fără el. De aceea lista n-are opțiune
 * goală, iar `an` intră în `cheiProprii` cu o valoare mereu prezentă.
 */
export function FiltreRegistru({ ani, tipuri }: Props) {
  const parametri = useSearchParams();

  const an = parametri.get("an") ?? String(ani[0] ?? new Date().getFullYear());
  const sens = parametri.get("sens") ?? "";
  const tip = parametri.get("tip") ?? "";
  const deLa = parametri.get("de_la") ?? "";
  const panaLa = parametri.get("pana_la") ?? "";
  const cautare = parametri.get("q") ?? "";

  // Gardă de tip, nu `as`: `sens` vine din adresă, deci e text străin. Un `as`
  // ar fi indexat harta cu orice și ar fi produs `undefined` în etichetă.
  const esteSens = (v: string): v is (typeof SENSURI)[number] =>
    (SENSURI as readonly string[]).includes(v);

  const active: readonly FiltruActiv[] = [
    !esteSens(sens) ? null : { cheie: "sens", eticheta: `Sens: ${ETICHETE_SENS[sens]}` },
    tip === "" ? null : { cheie: "tip", eticheta: `Tip: ${eticheteazaTipDocument(tip)}` },
    deLa === "" ? null : { cheie: "de_la", eticheta: `De la: ${deLa}` },
    panaLa === "" ? null : { cheie: "pana_la", eticheta: `Până la: ${panaLa}` },
    cautare === "" ? null : { cheie: "q", eticheta: `Caută: ${cautare}` },
  ].filter((f): f is FiltruActiv => f !== null);

  return (
    <BaraFiltre active={active} cheiProprii={["an", "sens", "tip", "de_la", "pana_la", "q"]}>
      <Camp nume="an" eticheta="Anul" fel="select" className="w-full sm:w-32">
        {(atribute) => (
          <select {...atribute} key={an} defaultValue={an}>
            {ani.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="sens" eticheta="Sens" fel="select" className="w-full sm:w-40">
        {(atribute) => (
          <select {...atribute} key={sens} defaultValue={sens}>
            <option value="">Toate</option>
            {SENSURI.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_SENS[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="tip" eticheta="Tip document" fel="select" className="w-full sm:w-56">
        {(atribute) => (
          <select {...atribute} key={tip} defaultValue={tip}>
            <option value="">Toate</option>
            {tipuri.map((t) => (
              <option key={t} value={t}>
                {eticheteazaTipDocument(t)}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="de_la" eticheta="De la" className="w-full sm:w-40">
        {(atribute) => <input {...atribute} key={deLa} type="date" defaultValue={deLa} />}
      </Camp>

      <Camp nume="pana_la" eticheta="Până la" className="w-full sm:w-40">
        {(atribute) => <input {...atribute} key={panaLa} type="date" defaultValue={panaLa} />}
      </Camp>

      <Camp nume="q" eticheta="Caută" className="w-full sm:w-56">
        {(atribute) => (
          <input
            {...atribute}
            key={cautare}
            type="search"
            defaultValue={cautare}
            placeholder="Rezumat, număr, destinatar"
          />
        )}
      </Camp>
    </BaraFiltre>
  );
}
