// src/components/ui/incarcare-fisier.tsx
"use client";

import { AlertCircle, Paperclip, Upload, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

import { buton, Buton } from "./buton";

/**
 * Câmpul de fișier.
 *
 * ── DE CE `"use client"` ──────────────────────────────────────────────────
 * Trei lucruri, toate în browser și niciunul obținut de la server:
 *   1. `onChange` pe input — singurul moment în care se află CE s-a ales;
 *   2. starea „fișierul ales” (nume + mărime), care se citește din obiectul
 *      `File` și nu există nicăieri altundeva;
 *   3. golirea inputului la respingere și la scoatere (`input.value = ""`),
 *      care cere o referință DOM.
 * Restul primitivelor din `src/components/ui/` rămân fără directivă exact ca
 * până acum — `camp.tsx` explică de ce a ocolit `useId` tocmai ca să nu ajungă
 * aici. Câmpul ăsta n-avea cum s-o ocolească.
 *
 * ── CE ÎNLOCUIEȘTE ────────────────────────────────────────────────────────
 * Cele trei `<input type="file">` din depozit, care fac trei lucruri diferite:
 *
 * · `angajati/[id]/documente/formular-document.tsx:128` —
 *   `<input type="file" required className="text-corp" />`. Fără `accept`, fără
 *   `name` (fișierul se citește din `ref`), fără `aria-describedby`. Limita e
 *   scrisă în etichetă, „Fișier (max. 20 MB)”, și NU e verificată în browser:
 *   omul urcă 40 MB și află de la server.
 * · `angajati/import/import-client.tsx:217` — singurul care leagă un
 *   `aria-describedby` și scrie limita. Tot fără verificare înainte de trimitere.
 * · `components/forms/incarcare-avatar.tsx:94` — are `accept`, scrie „până în
 *   2 MB” într-o notă, dar mărimea o respinge tot serverul.
 *
 * Niciunul nu arată ce s-a ales și niciunul nu se poate răzgândi: după ce ai
 * ales fișierul greșit, singura ieșire e să redeschizi dialogul sistemului.
 *
 * ── INPUTUL NATIV RĂMÂNE SURSA ADEVĂRULUI ─────────────────────────────────
 * `name` se pune ÎNTOTDEAUNA pe input, iar fișierul nu se ține nicăieri
 * altundeva. Consecința: formularul se trimite și cu JavaScript-ul oprit sau
 * necoborât încă — starea din React e o OGLINDĂ a inputului, nu înlocuitorul
 * lui. `formular-document.tsx` face invers azi (citește din `ref` și trimite
 * manual), deci acolo fără JavaScript nu pleacă nimic.
 *
 * ── DE CE `sr-only` + `<label>`, ȘI NU UN BUTON CU `.click()` ─────────────
 * Ambele tehnici din literatură ascund inputul fără `display: none` (care îl
 * scoate din ordinea de tabulare și îl face invizibil pentru cititorul de
 * ecran). Alegem eticheta, din motivul de mai sus:
 *
 * Un `<button onClick={() => ref.current.click()}>` cere JavaScript ca să
 * DESCHIDĂ dialogul. Fără el, singurul mod de a alege un fișier dispare — și
 * atunci `name` pe input nu mai folosește la nimic, fiindcă nu poate ajunge
 * niciodată să aibă o valoare. `<label htmlFor>` face același lucru din HTML
 * curat: activarea etichetei activează controlul, cu mouse, cu deget și cu
 * tastatură, fără o linie de cod.
 *
 * `sr-only` (1 px, decupat) păstrează inputul focusabil, deci Tab ajunge la el
 * și Space/Enter deschide dialogul. Ce se pierde e INELUL de focus: regula
 * globală `:focus-visible` din `globals.css` îl desenează pe input, iar acolo e
 * decupat. De aceea eticheta vizibilă îl preia cu `has-[:focus-visible]` —
 * relee, nu inel scris local, exact ca `focus-within:outline-2` din
 * `angajati/filtre-angajati.tsx:42`. `has-`, nu `focus-within`, ca să nu apară
 * un inel la clic de mouse.
 *
 * Controlul are DOUĂ etichete care trimit spre același `id`: numele câmpului,
 * deasupra, și butonul. Numele accesibil e concatenarea lor, în ordinea din
 * DOM — „Fișier justificativ Alege fișierul” — care e exact ce trebuie auzit.
 * Cu o singură etichetă ai fi pierdut ori numele câmpului (trei câmpuri
 * numite toate „Alege fișierul”), ori butonul.
 *
 * ── RESTRICȚIILE SE VĂD ÎNAINTE, NU DUPĂ ──────────────────────────────────
 * `restrictii` e OBLIGATORIE. Un câmp care respinge după alegere ceva ce nu
 * anunțase înainte e o capcană, iar WCAG 3.3.2 cere instrucțiunile la câmp, nu
 * în mesajul de eroare. Textul vine ca prop, ca tot restul: primitivele nu au
 * șiruri proprii de conținut, fiindcă stratul de marketing e bilingv și le
 * importă.
 *
 * Verificarea de mărime se face ȘI în browser, nu doar pe server: e diferența
 * dintre a afla imediat și a aștepta să se urce 40 MB ca să ți se spună nu.
 * Serverul rămâne singura autoritate — clientul e doar politicos.
 */

/** 1024, nu 1000. `import-client.tsx:212` calculează deja limita cu 1024; dacă
 * ecranul scrie „20 MB” cu o bază și verifică cu alta, un fișier de 20,3 MB e
 * respins de un ecran care tocmai i-a promis că încape. */
const PAS = 1024;

/** Simboluri SI, identice în orice limbă — deci nu sunt conținut traductibil. */
const UNITATI = ["B", "kB", "MB", "GB"] as const;

/** „2,4 MB”. Zecimală doar sub 10: „9,4 MB” ajută la decizie, „9,43 MB” nu. */
export function marimeCitibila(octeti: number): string {
  let valoare = Math.max(0, octeti);
  let treapta = 0;
  while (valoare >= PAS && treapta < UNITATI.length - 1) {
    valoare /= PAS;
    treapta += 1;
  }
  const zecimale = treapta === 0 || valoare >= 10 ? 0 : 1;
  // `minimumFractionDigits: 0`, nu `zecimale`: altfel un fișier de fix 1 MB se
  // scrie „1,0 MB”, iar zecimala aia sugerează o precizie care nu există.
  const cifre = valoare.toLocaleString("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: zecimale,
  });
  return `${cifre} ${UNITATI[treapta] ?? UNITATI[0]}`;
}

/**
 * Verifică un fișier față de atributul `accept`, cu aceleași reguli ca
 * browserul: extensie (`.xlsx`), familie (`image/*`) sau tip exact.
 *
 * Extensia se verifică pe NUME, nu pe `type`: Windows raportează `type` gol
 * pentru `.xlsx` destul de des, iar `angajati/import` acceptă exact
 * `.xlsx,.xlsm` — o verificare doar pe MIME ar respinge tocmai fișierul pentru
 * care există ecranul.
 */
export function seIncadreazaInAccept(fisier: File, accept: string): boolean {
  const reguli = accept
    .split(",")
    .map((regula) => regula.trim().toLowerCase())
    .filter((regula) => regula !== "");
  if (reguli.length === 0) return true;

  const tip = fisier.type.toLowerCase();
  const nume = fisier.name.toLowerCase();
  return reguli.some((regula) => {
    if (regula.startsWith(".")) return nume.endsWith(regula);
    if (regula.endsWith("/*")) return tip !== "" && tip.startsWith(regula.slice(0, -1));
    return tip === regula;
  });
}

type PropsComune = Readonly<{
  /** Numele din `FormData`. Din el se derivă și identificatorii, ca la `Camp`. */
  nume: string;
  eticheta: string;
  /** Suprascrie identificatorul derivat — două formulare pe același ecran. */
  id?: string;
  /** `accept` nativ: filtrează dialogul sistemului. */
  accept?: string;
  /** Restricțiile, scrise. Se citesc ÎNAINTE de alegere. */
  restrictii: string;
  /** Textul de pe eticheta-buton care deschide dialogul. */
  textAlegere: string;
  /** Numele accesibil al butonului care scoate fișierul ales. */
  etichetaScoate: string;
  /**
   * Mesajul pentru un tip pe care `accept` ar fi trebuit să-l oprească. Absent
   * = ne bazăm doar pe filtrul dialogului, care se poate ocoli cu „Toate
   * fișierele” în majoritatea browserelor.
   */
  mesajTipRespins?: string;
  obligatoriu?: boolean;
  /** Erorile venite din `ActionResult.fieldErrors`, ca la `Camp`. */
  erori?: readonly string[];
  /** Se cheamă după fiecare schimbare ACCEPTATĂ, și cu `null` la respingere sau scoatere. */
  laSchimbare?: (fisier: File | null) => void;
  className?: string;
}>;

/**
 * Uniune discriminată, ca la `PropsButon`: o limită de mărime fără mesajul ei
 * **nu compilează**. Altfel câmpul ar respinge tăcut un fișier de 40 MB, exact
 * defectul pe care primitiva vine să-l repare.
 */
export type PropsIncarcareFisier = PropsComune &
  (Readonly<{ maxOcteti?: undefined }> | Readonly<{ maxOcteti: number; mesajPreaMare: string }>);

export function IncarcareFisier(props: PropsIncarcareFisier): ReactElement {
  // Se citește ÎNAINTE de destructurare: destructurarea rupe îngustarea uniunii.
  const limita =
    props.maxOcteti === undefined ? null : { octeti: props.maxOcteti, mesaj: props.mesajPreaMare };

  const {
    nume,
    eticheta,
    id,
    accept,
    restrictii,
    textAlegere,
    etichetaScoate,
    mesajTipRespins,
    obligatoriu,
    erori,
    laSchimbare,
    className,
  } = props;

  const referinta = useRef<HTMLInputElement | null>(null);
  const [ales, setAles] = useState<File | null>(null);
  const [respins, setRespins] = useState<string | null>(null);

  const idCamp = id ?? `camp-${nume}`;
  const idRestrictii = `${idCamp}-restrictii`;
  const idEroare = `${idCamp}-eroare`;

  // Respingerea din browser trece înaintea erorilor de la server: e cea care
  // descrie fișierul din fața omului, nu pe cel trimis data trecută.
  const mesaje = [...(respins === null ? [] : [respins]), ...(erori ?? [])];
  const areEroare = mesaje.length > 0;

  // Aceeași ordine ca la `Camp`: întâi ce e greșit, apoi ce se aștepta.
  const descrieri = [areEroare ? idEroare : null, idRestrictii]
    .filter((v): v is string => v !== null)
    .join(" ");

  function motivRespingerii(fisier: File): string | null {
    if (limita !== null && fisier.size > limita.octeti) return limita.mesaj;
    if (
      mesajTipRespins !== undefined &&
      accept !== undefined &&
      !seIncadreazaInAccept(fisier, accept)
    ) {
      return mesajTipRespins;
    }
    return null;
  }

  function laAlegere(eveniment: ChangeEvent<HTMLInputElement>): void {
    const camp = eveniment.currentTarget;
    const fisier = camp.files?.[0] ?? null;

    if (fisier === null) {
      setAles(null);
      setRespins(null);
      laSchimbare?.(null);
      return;
    }

    const motiv = motivRespingerii(fisier);
    if (motiv !== null) {
      // Inputul se golește: altfel formularul ar pleca la server exact cu
      // fișierul pe care tocmai l-am declarat inacceptabil.
      camp.value = "";
      setAles(null);
      setRespins(motiv);
      laSchimbare?.(null);
      return;
    }

    setAles(fisier);
    setRespins(null);
    laSchimbare?.(fisier);
  }

  function scoate(): void {
    const camp = referinta.current;
    if (camp !== null) {
      camp.value = "";
      // Focusul nu are voie să dispară odată cu butonul care îl ținea: ar sări
      // pe `<body>`, iar următorul Tab ar relua pagina de la început.
      camp.focus();
    }
    setAles(null);
    setRespins(null);
    laSchimbare?.(null);
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={idCamp} className="text-foreground text-corp mb-1 block font-medium">
        {eticheta}
        {obligatoriu === true ? (
          <>
            {" "}
            <span className="text-danger" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(obligatoriu)</span>
          </>
        ) : null}
      </label>

      <p id={idRestrictii} className="text-muted-foreground text-nota mb-2">
        {restrictii}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={idCamp}
          className={cn(
            buton({ varianta: "secundar" }),
            "cursor-pointer",
            // Releul inelului de focus — vezi docblock. NU un inel scris local:
            // culoarea și grosimea rămân ale regulii globale.
            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
          )}
        >
          <Upload aria-hidden="true" className="size-4 shrink-0" />
          {textAlegere}
          <input
            ref={referinta}
            id={idCamp}
            name={nume}
            type="file"
            onChange={laAlegere}
            required={obligatoriu === true ? true : undefined}
            aria-invalid={areEroare ? true : undefined}
            aria-describedby={descrieri === "" ? undefined : descrieri}
            {...(accept === undefined ? {} : { accept })}
            className="sr-only"
          />
        </label>

        {/* Regiunea există în DOM și când e goală. O regiune `aria-live`
            inserată ODATĂ cu conținutul ei nu se anunță în majoritatea
            cititoarelor de ecran — trebuie să fi fost acolo dinainte. */}
        <p
          aria-live="polite"
          className="text-corp text-foreground flex min-w-0 flex-1 items-center gap-2"
        >
          {ales === null ? null : (
            <>
              <Paperclip aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 truncate">{ales.name}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                <span aria-hidden="true" className="me-1.5">
                  ·
                </span>
                {marimeCitibila(ales.size)}
              </span>
              <Buton
                marime="iconita"
                varianta="tertiar"
                aria-label={etichetaScoate}
                onClick={scoate}
                className="shrink-0"
              >
                <X aria-hidden="true" className="size-4" />
              </Buton>
            </>
          )}
        </p>
      </div>

      {areEroare ? (
        <p
          id={idEroare}
          role="alert"
          className="text-danger text-nota mt-1 flex items-start gap-1.5"
        >
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0 translate-y-px" />
          <span>{mesaje.join(" ")}</span>
        </p>
      ) : null}
    </div>
  );
}
