// src/app/(app)/angajati/sabloane-documente/editor-sablon.tsx
"use client";

import { useCallback, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, List, ListOrdered, Pilcrow, Redo2, Undo2 } from "lucide-react";

import { DESCRIERI_VARIABILE } from "@/lib/documents/variabile";

/**
 * Editorul de șablon.
 *
 * ── DE CE O SCHEMĂ ATÂT DE MICĂ ────────────────────────────────────────────
 * Fiecare buton din bară trebuie să supraviețuiască până în PDF. Lanțul e:
 * editorul de aici → `curataHtml` la salvare (șapte etichete, zero atribute) →
 * `din-html.ts` la randare. Un buton care produce ceva ce ultimele două aruncă
 * ar fi o formatare care se vede pe ecran și dispare de pe hârtie, fără niciun
 * mesaj — exact felul de defect tăcut pe care proiectul îl adună în registrul
 * de capcane.
 *
 * De aceea lipsesc, deliberat:
 *   • CURSIVELE — în `src/lib/pdf/fonturi/` sunt încorporate doar
 *     `DejaVuSans.ttf` și `DejaVuSans-Bold.ttf`. Cursivele ar cere un al
 *     treilea fișier de font, nu o linie de configurare.
 *   • TITLUL DE NIVEL 1 — `din-html.ts:92-96` îl sare deliberat: titlul mare e
 *     deja în antetul PDF-ului, iar repetat ar apărea de două ori pe prima
 *     pagină. Denumirea documentului se editează în câmpul de deasupra.
 *   • LEGĂTURI, TABELE, IMAGINI, CITATE, COD — niciuna nu e randată de PDF.
 */
const EXTENSII = [
  StarterKit.configure({
    heading: { levels: [2] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    italic: false,
    link: false,
    strike: false,
    underline: false,
  }),
];

export type PropsEditorSablon = Readonly<{
  /** HTML-ul de pornire — al firmei dacă există, altfel seed-ul de platformă. */
  continutInitial: string;
  /** Variabilele permise pentru codul editat. */
  variabile: readonly string[];
  /** Numele câmpului ascuns prin care HTML-ul ajunge în `FormData`. */
  nume: string;
  inCurs: boolean;
}>;

function ButonBara({
  activ,
  eticheta,
  pictograma,
  laClic,
  disabled,
}: Readonly<{
  activ?: boolean;
  eticheta: string;
  pictograma: React.ReactNode;
  laClic: () => void;
  disabled?: boolean;
}>): React.ReactElement {
  return (
    <button
      type="button"
      title={eticheta}
      aria-label={eticheta}
      aria-pressed={activ ?? false}
      disabled={disabled ?? false}
      onClick={laClic}
      className={`hover:bg-muted flex size-8 items-center justify-center rounded-xs transition-colors disabled:opacity-40 ${
        activ === true ? "bg-muted text-foreground" : "text-muted-foreground"
      }`}
    >
      {pictograma}
    </button>
  );
}

export function EditorSablon({
  continutInitial,
  variabile,
  nume,
  inCurs,
}: PropsEditorSablon): React.ReactElement {
  const [html, setHtml] = useState(continutInitial);

  const editor = useEditor({
    extensions: EXTENSII,
    content: continutInitial,
    // Obligatoriu în App Router: randarea imediată pe server produce o
    // nepotrivire de hidratare, fiindcă ProseMirror atașează atribute pe care
    // serverul nu le-a scris.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-80 max-w-none px-3 py-2 focus:outline-none [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:font-semibold [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold",
      },
    },
    onUpdate: ({ editor: curent }: { editor: Editor }) => {
      setHtml(curent.getHTML());
    },
  });

  const insereazaVariabila = useCallback(
    (variabila: string) => {
      if (editor === null) return;
      // `insertContent` cu text simplu, nu cu HTML: acoladele n-au nicio
      // semnificație de marcaj, iar textul intră exact unde e cursorul.
      editor.chain().focus().insertContent(`{{${variabila}}}`).run();
    },
    [editor],
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name={nume} value={html} />

      <div className="border-border rounded-panou overflow-hidden border">
        <div className="border-border bg-card flex flex-wrap items-center gap-1 border-b px-2 py-1">
          <ButonBara
            eticheta="Paragraf"
            pictograma={<Pilcrow aria-hidden="true" className="size-4" />}
            activ={editor?.isActive("paragraph") === true}
            disabled={editor === null || inCurs}
            laClic={() => editor?.chain().focus().setParagraph().run()}
          />
          <ButonBara
            eticheta="Titlu de secțiune"
            pictograma={<Heading2 aria-hidden="true" className="size-4" />}
            activ={editor?.isActive("heading", { level: 2 }) === true}
            disabled={editor === null || inCurs}
            laClic={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ButonBara
            eticheta="Îngroșat"
            pictograma={<Bold aria-hidden="true" className="size-4" />}
            activ={editor?.isActive("bold") === true}
            disabled={editor === null || inCurs}
            laClic={() => editor?.chain().focus().toggleBold().run()}
          />
          <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />
          <ButonBara
            eticheta="Listă cu buline"
            pictograma={<List aria-hidden="true" className="size-4" />}
            activ={editor?.isActive("bulletList") === true}
            disabled={editor === null || inCurs}
            laClic={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ButonBara
            eticheta="Listă numerotată"
            pictograma={<ListOrdered aria-hidden="true" className="size-4" />}
            activ={editor?.isActive("orderedList") === true}
            disabled={editor === null || inCurs}
            laClic={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />
          <ButonBara
            eticheta="Anulează"
            pictograma={<Undo2 aria-hidden="true" className="size-4" />}
            disabled={editor === null || inCurs}
            laClic={() => editor?.chain().focus().undo().run()}
          />
          <ButonBara
            eticheta="Refă"
            pictograma={<Redo2 aria-hidden="true" className="size-4" />}
            disabled={editor === null || inCurs}
            laClic={() => editor?.chain().focus().redo().run()}
          />
        </div>

        <EditorContent editor={editor} />
      </div>

      <div className="space-y-2">
        <p className="text-eticheta text-muted-foreground uppercase">
          Variabile — clic pentru a insera
        </p>
        <div className="flex flex-wrap gap-1.5">
          {/*
            Chip-uri, nu `Buton`: `marime` e o uniune discriminată cu doar
            „implicit" și „iconita", fiindcă design system-ul refuză deliberat
            butoanele mici. O paletă de 20 de variabile în butoane de mărime
            normală ar ocupa jumătate de ecran, deci aici e marcaj propriu, nu o
            mărime nouă strecurată în componenta comună.
          */}
          {variabile.map((variabila) => (
            <button
              key={variabila}
              type="button"
              disabled={editor === null || inCurs}
              title={DESCRIERI_VARIABILE[variabila] ?? variabila}
              onClick={() => {
                insereazaVariabila(variabila);
              }}
              className="border-border bg-card hover:bg-muted text-nota rounded-xs border px-2 py-1 font-mono transition-colors disabled:opacity-40"
            >
              {`{{${variabila}}}`}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-nota">
          Se înlocuiesc la emitere cu datele angajatului. O variabilă scrisă de mână, care nu e în
          lista de mai sus, împiedică emiterea documentului pentru toți angajații.
        </p>
      </div>
    </div>
  );
}
