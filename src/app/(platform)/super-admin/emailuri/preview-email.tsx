// src/app/(platform)/super-admin/emailuri/preview-email.tsx
"use client";
import { useCallback, useId, useRef, useState } from "react";
import { Eye, X } from "lucide-react";

type Props = Readonly<{ subiect: string; sablon: string; html: string }>;

/**
 * HTML-ul e afișat într-un <iframe sandbox> gol (fără allow-scripts, fără allow-same-origin),
 * deci nu poate rula JS și nu are acces la sesiunea aplicației. Niciodată dangerouslySetInnerHTML.
 */
export function PreviewEmail({ subiect, sablon, html }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deschis, setDeschis] = useState(false);
  const titluId = useId();

  const deschide = useCallback(() => {
    setDeschis(true);
    dialogRef.current?.showModal();
  }, []);
  const inchide = useCallback(() => {
    setDeschis(false);
    dialogRef.current?.close();
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={deschide}
        className="border-border text-foreground hover:bg-surface rounded-control text-nota inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-medium"
      >
        <Eye aria-hidden="true" className="size-3.5" />
        Vezi conținutul
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titluId}
        onClose={() => setDeschis(false)}
        className="border-border bg-surface text-foreground rounded-panou m-auto w-[min(680px,92vw)] border p-0 backdrop:bg-black/50"
      >
        <div className="border-border flex items-start justify-between gap-4 border-b p-4">
          <div>
            <h2 id={titluId} className="text-corp font-semibold">
              {subiect}
            </h2>
            <p className="text-muted-foreground text-nota mt-0.5">
              Previzualizare a șablonului „{sablon}” cu date exemplu.
            </p>
          </div>
          <button
            type="button"
            onClick={inchide}
            className="text-muted-foreground hover:bg-background rounded-control p-1"
            aria-label="Închide previzualizarea"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {deschis ? (
          <iframe
            title={`Previzualizare email: ${subiect}`}
            sandbox=""
            srcDoc={html}
            className="bg-background h-[60vh] w-full border-0"
          />
        ) : null}
      </dialog>
    </>
  );
}
