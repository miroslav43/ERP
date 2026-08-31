// src/components/asistent/panou-asistent.tsx
"use client";

import { RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { clasaControl } from "@/components/ui/camp";
import { Rotita } from "@/components/incarcare/rotita";
import type { StareAsistent } from "@/lib/asistent/depozit";
import { inchideAsistent, reseteazaAsistent, trimiteIntrebare } from "@/lib/asistent/depozit";
import { MAX_CARACTERE_MESAJ } from "@/schemas/asistent";
import { cn } from "@/lib/ui/cn";

import { MesajAsistent } from "./mesaj-asistent";

/** Ce se poate întreba, când conversația e goală. Diferite pe cele două zone. */
const SUGESTII: Readonly<Record<"app" | "portal", readonly string[]>> = {
  app: [
    "Unde aprob pontajul echipei?",
    "Am ceva de semnat?",
    "Cum adaug un angajat nou?",
    "Unde văd ce documente expiră?",
  ],
  portal: [
    "Câte zile de concediu mai am?",
    "Unde îmi trec orele de ieri?",
    "Cum cer concediu?",
    "Unde îmi găsesc fluturașul?",
  ],
};

export function PanouAsistent({
  stare,
  zona,
}: Readonly<{ stare: StareAsistent; zona: "app" | "portal" }>): ReactElement {
  const idIntrebare = useId();
  const idTitlu = useId();
  const capatul = useRef<HTMLDivElement | null>(null);
  const camp = useRef<HTMLTextAreaElement | null>(null);

  const ultimul = stare.mesaje.at(-1);
  const lungimeUltim = ultimul?.text.length ?? 0;

  // Lipit de ultimul rând cât timp răspunsul crește. `block: "nearest"` ca să nu
  // smucească întreaga pagină de sub panou pe telefon.
  useEffect(() => {
    capatul.current?.scrollIntoView({ block: "nearest" });
  }, [stare.mesaje.length, lungimeUltim, stare.unealta]);

  function trimite(date: FormData): void {
    const text = String(date.get("intrebare") ?? "");
    void trimiteIntrebare(text, zona);
  }

  function laTasta(eveniment: KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter trimite, Shift+Enter trece pe rând nou — convenția oricărui chat.
    // Pe telefon nu se aplică: acolo Enter e rând nou, iar butonul e la degete.
    if (eveniment.key !== "Enter" || eveniment.shiftKey) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    eveniment.preventDefault();
    eveniment.currentTarget.form?.requestSubmit();
  }

  const gol = stare.mesaje.length === 0;

  return (
    <section
      aria-labelledby={idTitlu}
      className={cn(
        "border-border bg-background shadow-plutitor pointer-events-auto flex flex-col border",
        // Telefon: card pe toată lățimea disponibilă, deasupra bulei.
        "rounded-panou max-h-[75dvh] w-full",
        // Desktop: înălțime fixă, ca panoul să nu sară la fiecare răspuns nou.
        "md:h-[32rem] md:max-h-[calc(100dvh-10rem)] md:w-[24rem]",
      )}
    >
      <header className="border-border flex items-center gap-2 border-b px-3 py-2">
        <Sparkles aria-hidden="true" className="text-primary size-4 shrink-0" />
        <h2 id={idTitlu} className="text-corp min-w-0 flex-1 font-medium">
          Asistent
        </h2>
        {gol ? null : (
          <Buton
            varianta="tertiar"
            marime="iconita"
            aria-label="Începe o conversație nouă"
            onClick={reseteazaAsistent}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
          </Buton>
        )}
        <Buton
          varianta="tertiar"
          marime="iconita"
          aria-label="Închide asistentul"
          onClick={inchideAsistent}
        >
          <X aria-hidden="true" className="size-4" />
        </Buton>
      </header>

      <div
        // `log` + `polite`: cititorul de ecran anunță răspunsul când sosește,
        // fără să întrerupă ce citea omul.
        role="log"
        aria-live="polite"
        aria-busy={stare.raspunde}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
      >
        {gol ? (
          <Sugestii zona={zona} />
        ) : (
          <div className="flex flex-col gap-4">
            {stare.mesaje.map((mesaj, i) => (
              <MesajAsistent
                key={mesaj.id}
                mesaj={mesaj}
                inCurs={stare.raspunde && i === stare.mesaje.length - 1}
                efemere={stare.efemere}
                laNavigare={inchideAsistent}
              />
            ))}
          </div>
        )}

        {stare.raspunde && (ultimul?.text ?? "") === "" ? (
          <p className="text-nota text-muted-foreground mt-3 flex items-center gap-2">
            <Rotita marime="mica" />
            {stare.unealta === null ? "Se gândește…" : "Caut datele…"}
          </p>
        ) : null}

        {stare.eroare === null ? null : (
          <p role="alert" className="text-nota text-danger mt-3">
            {stare.eroare}
          </p>
        )}

        <div ref={capatul} />
      </div>

      <form action={trimite} className="border-border flex items-end gap-2 border-t p-2">
        <label htmlFor={idIntrebare} className="sr-only">
          Întrebarea ta
        </label>
        <textarea
          ref={camp}
          id={idIntrebare}
          name="intrebare"
          rows={1}
          maxLength={MAX_CARACTERE_MESAJ}
          required
          disabled={stare.raspunde}
          onKeyDown={laTasta}
          placeholder="Întreabă unde se face un lucru…"
          className={cn(clasaControl({ fel: "textarea" }), "max-h-28 min-h-10 flex-1 resize-none")}
        />
        <Buton
          type="submit"
          varianta="primar"
          marime="iconita"
          aria-label="Trimite întrebarea"
          disabled={stare.raspunde}
        >
          <SendHorizontal aria-hidden="true" className="size-4" />
        </Buton>
      </form>
    </section>
  );
}

function Sugestii({ zona }: Readonly<{ zona: "app" | "portal" }>): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-corp text-muted-foreground">
        Întreabă unde se face un lucru în aplicație. Îți spun pe unde se ajunge și îți dau butonul
        care te duce acolo.
      </p>
      <ul className="flex flex-col gap-1.5 pt-1">
        {SUGESTII[zona].map((sugestie) => (
          <li key={sugestie}>
            <button
              type="button"
              onClick={() => void trimiteIntrebare(sugestie, zona)}
              className={cn(
                "border-border bg-surface rounded-control text-corp w-full border px-3 py-2 text-start",
                "hover:border-primary/40 hover:bg-background transition-colors",
              )}
            >
              {sugestie}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
