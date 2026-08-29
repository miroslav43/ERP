"use client";

import Link from "next/link";
import { Smartphone, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { buton } from "@/components/ui/buton";
import { cn } from "@/lib/ui/cn";

/**
 * Banda care invită la instalarea aplicației pe ecranul de start.
 *
 * ── DE CE `useSyncExternalStore`, NU `useState` + `useEffect` ───────────────
 * Serverul nu are cum să știe dacă cererea vine din aplicația deja instalată:
 * `display-mode` și `navigator.standalone` există numai în browser. Varianta
 * evidentă — starea inițială `false`, corectată într-un efect — e exact ce
 * interzice `react-hooks/set-state-in-effect`: un `setState` sincron în corpul
 * efectului declanșează o a doua randare în cascadă imediat după hidratare.
 *
 * `useSyncExternalStore` e unealta făcută pentru fix cazul ăsta: citește o
 * valoare din afara React (aici: modul de afișare al ferestrei și memoria
 * locală), dă serverului un instantaneu propriu (`false` — nu desenăm nimic în
 * HTML-ul trimis) și lasă React să facă tranziția o singură dată, la hidratare,
 * fără nepotrivire.
 *
 * ── CELE DOUĂ FELURI DE „SUNT INSTALAT" ─────────────────────────────────────
 * Android și desktop expun `matchMedia("(display-mode: standalone)")`. iOS NU îl
 * raportează fidel pentru aplicațiile de pe ecranul de start și folosește în
 * schimb `navigator.standalone`, o proprietate nestandardizată, absentă din
 * tipurile DOM. Se verifică amândouă; una singură lasă jumătate din utilizatori
 * cu o bandă care îi invită să instaleze ceva ce au deja.
 *
 * ── BUTONUL NATIV APARE DOAR DACĂ CHROME ÎL OFERĂ ───────────────────────────
 * `beforeinstallprompt` nu există pe iOS deloc, iar pe Android Chrome îl emite
 * abia după un prag de angajament (o atingere și ~30 de secunde pe pagină). Un
 * buton „Instalează" randat necondiționat ar fi mort pentru majoritatea
 * oamenilor. Aici e invers: linkul către instrucțiuni e mereu acolo, iar butonul
 * nativ se ADAUGĂ dacă evenimentul chiar sosește. Acel `setState` e într-un
 * ascultător de evenimente, nu în corpul efectului — permis și corect.
 */

/**
 * Evenimentul Chrome de instalare. Nu e în tipurile DOM standard fiindcă nu e
 * standardizat — se descrie local exact cât se folosește.
 */
interface EvenimentInstalare extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHEIE_ASCUNS = "administrativo:indemn-instalare-ascuns";

/* ── Depozitul extern ───────────────────────────────────────────────────────
 *
 * Trei valori, două imuabile pe viața paginii (rulez instalat? am ascuns-o
 * cândva?) și una care se schimbă o singură dată (tocmai am ascuns-o).
 * `getSnapshot` TREBUIE să întoarcă aceeași valoare la apeluri succesive cât
 * timp nimic nu s-a schimbat — altfel React reintră la nesfârșit. De aceea
 * partea scumpă se calculează o dată și se ține în `cachePotrivit`.
 */

let cachePotrivit: boolean | null = null;
let ascunsAcum = false;
const abonati = new Set<() => void>();

/** `true` când pagina rulează din aplicația adăugată pe ecranul de start. */
function ruleazaInstalat(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS: proprietate nestandardizată pe `navigator`, absentă din tipuri.
  const nav: unknown = window.navigator;
  return (
    typeof nav === "object" && nav !== null && (nav as { standalone?: boolean }).standalone === true
  );
}

/** Refuzul de altădată, ținut minte pe dispozitivul omului. */
function ascunsDinainte(): boolean {
  try {
    return window.localStorage.getItem(CHEIE_ASCUNS) === "1";
  } catch {
    // Fereastră privată sau date de sit blocate: banda apare de fiecare dată.
    // O bandă în plus e infinit mai bună decât un ecran alb.
    return false;
  }
}

function instantaneu(): boolean {
  cachePotrivit ??= !ruleazaInstalat() && !ascunsDinainte();
  return cachePotrivit && !ascunsAcum;
}

/** Pe server nu se desenează nimic: nu există `window` de întrebat. */
function instantaneuServer(): boolean {
  return false;
}

function abonare(schimbare: () => void): () => void {
  abonati.add(schimbare);
  return () => {
    abonati.delete(schimbare);
  };
}

function ascunde(): void {
  ascunsAcum = true;
  for (const schimbare of abonati) schimbare();
  try {
    window.localStorage.setItem(CHEIE_ASCUNS, "1");
  } catch {
    // Vezi mai sus: dispariția e oricum imediată în sesiunea curentă.
  }
}

export function IndemnInstalare() {
  const vizibil = useSyncExternalStore(abonare, instantaneu, instantaneuServer);
  const [evenimentNativ, setEvenimentNativ] = useState<EvenimentInstalare | null>(null);

  useEffect(() => {
    const laPrompt = (eveniment: Event): void => {
      // Fără `preventDefault()`, Chrome își arată propriul banner și pe al
      // nostru nu-l mai lasă să facă nimic.
      eveniment.preventDefault();
      setEvenimentNativ(eveniment as EvenimentInstalare);
    };
    window.addEventListener("beforeinstallprompt", laPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", laPrompt);
    };
  }, []);

  if (!vizibil) return null;

  function instaleaza(): void {
    if (evenimentNativ === null) return;
    void evenimentNativ.prompt().then(async () => {
      const { outcome } = await evenimentNativ.userChoice;
      // Evenimentul e de unică folosință: după o alegere, `prompt()` aruncă.
      setEvenimentNativ(null);
      if (outcome === "accepted") ascunde();
    });
  }

  return (
    // `md:hidden`: pe laptop iconița pe ecranul de start n-are rost, iar banda
    // ar fi zgomot permanent pentru cine lucrează de la birou.
    <section
      aria-labelledby="indemn-instalare"
      className="border-border bg-surface rounded-panou flex items-start gap-3 border p-3 md:hidden"
    >
      <Smartphone aria-hidden="true" className="text-primary mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p id="indemn-instalare" className="text-foreground text-corp font-medium">
          Puneți aplicația pe ecranul telefonului
        </p>
        <p className="text-muted-foreground text-corp mt-0.5">
          Se deschide dintr-o atingere, ca orice aplicație. Nu se descarcă din niciun magazin.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {evenimentNativ === null ? null : (
            <button type="button" onClick={instaleaza} className={buton({ varianta: "primar" })}>
              Instalează
            </button>
          )}
          <Link
            href="/portal/instalare"
            className={cn(buton({ varianta: evenimentNativ === null ? "primar" : "link" }))}
          >
            Cum se face
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={ascunde}
        aria-label="Ascunde invitația de instalare"
        className="hover:bg-background rounded-control text-muted-foreground -m-1 flex size-11 shrink-0 items-center justify-center"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </section>
  );
}
