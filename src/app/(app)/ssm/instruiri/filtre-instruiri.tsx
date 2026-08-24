"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { cn } from "@/lib/ui/cn";
import { DOMENII_SSM } from "@/schemas/ssm";

import { ETICHETE_DOMENIU } from "../etichete";

/**
 * Tab obligatoriu SSM/PSI — implicit „ssm” — plus căutare după numele
 * angajatului. Niciun ecran nu amestecă cele două domenii: sunt obligații
 * legale distincte, cu periodicități proprii.
 *
 * ── CE PIERDEA VECHIUL `aplica()` ─────────────────────────────────────────
 * Pornea din `new URLSearchParams()` GOL și repopula doar `domeniu` și `q`,
 * deci fiecare apăsare pe „Filtrează” arunca `limita` — mărimea de pagină
 * aleasă din paginare, singurul alt parametru pe care matricea îl citește
 * (`filtreInstruiriSchema`). Omul își alegea 100 de rânduri, filtra după un
 * nume și se trezea înapoi la 25, fără nicio indicație.
 *
 * `<BaraFiltre>` pornește ÎNTOTDEAUNA din `useSearchParams()`, deci `limita`
 * (și orice cheie viitoare) supraviețuiește prin construcție.
 *
 * `cheiProprii` e doar `["q"]`, nu `["domeniu", "q"]`: `domeniu` nu era
 * ADMINISTRAT de vechiul `aplica()`, ci doar recopiat ca să nu se piardă la
 * repopularea din gol. Îl administrează tablist-ul de mai jos, iar bara îl
 * păstrează fără să-l atingă. Trecut în `cheiProprii` fără un câmp de formular
 * omonim, prima filtrare l-ar fi ȘTERS — adică ar fi aruncat tăcut ecranul de
 * pe PSI înapoi pe SSM.
 */
export function FiltreInstruiri() {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();

  const domeniuCurent = parametri.get("domeniu") === "psi" ? "psi" : "ssm";
  const cautare = parametri.get("q") ?? "";

  function schimbaDomeniu(domeniu: string): void {
    const noi = new URLSearchParams(parametri.toString());
    noi.set("domeniu", domeniu);
    noi.delete("cursor");
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  const active: readonly FiltruActiv[] =
    cautare === "" ? [] : [{ cheie: "q", eticheta: `Angajat: ${cautare}` }];

  return (
    <div className="space-y-3">
      {/*
        Tab-ul rămâne în afara barei: nu e un câmp de formular, ci o navigare, iar
        alegerea lui pleacă imediat, fără „Filtrează”. Pornește deja din
        parametrii existenți, deci nici el nu pierde nimic.
      */}
      <div
        role="tablist"
        aria-label="Domeniu"
        className="border-foreground/60 rounded-control inline-flex border"
      >
        {DOMENII_SSM.map((d) => (
          <Buton
            key={d}
            role="tab"
            aria-selected={domeniuCurent === d}
            varianta={domeniuCurent === d ? "primar" : "tertiar"}
            disabled={inCurs}
            onClick={() => {
              schimbaDomeniu(d);
            }}
            className={cn(
              "first:rounded-l-control last:rounded-r-control rounded-none",
              domeniuCurent === d ? "" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {ETICHETE_DOMENIU[d]}
          </Buton>
        ))}
      </div>

      <BaraFiltre active={active} cheiProprii={["q"]}>
        <Camp nume="q" eticheta="Caută angajat" className="w-full sm:w-64">
          {(atribute) => (
            // `key` pe valoarea din adresă: un `defaultValue` schimbat nu ajunge
            // niciodată într-un input deja montat, deci fără remontare ștergerea
            // pastilei ar goli adresa și ar lăsa textul vechi în câmp.
            <input
              {...atribute}
              key={cautare}
              type="search"
              defaultValue={cautare}
              placeholder="Nume angajat"
            />
          )}
        </Camp>
      </BaraFiltre>
    </div>
  );
}
