"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { formatDateTime } from "@/lib/format/date";
import { citesteNotificarileRecente, type NotificareRecenta } from "@/app/(app)/notificari/actions";

/**
 * Clopoțelul din antet, cu previzualizare.
 *
 * Era doar un link spre `/notificari`: ca să ajungi la o aprobare de concediu
 * făceai patru clicuri — clopoțel → listă → rând → obiect (analiza 2026-10-08,
 * notificari-L10/P7). La deschidere se cer ultimele cinci necitite, printr-o
 * acțiune de server care le și traduce la obiect (`caleaInAplicatie`), nu în
 * antet — antetul se randează pe fiecare navigare și nu plătește nimic până
 * nu se apasă. `<details>`, ca să se deschidă și la tastatură fără nimic de
 * suprascris din foaia UA a lui `popover`.
 */
export function Clopotel({ necitite }: Readonly<{ necitite: number }>): ReactElement {
  const [randuri, setRanduri] = useState<readonly NotificareRecenta[] | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);

  async function incarca(deschis: boolean): Promise<void> {
    if (!deschis || randuri !== null) return;
    const rezultat = await citesteNotificarileRecente();
    if (!rezultat.ok) {
      setEroare(rezultat.error.message);
      return;
    }
    setRanduri(rezultat.data);
  }

  return (
    <details
      className="relative"
      onToggle={(e) => {
        void incarca(e.currentTarget.open);
      }}
    >
      <summary
        aria-label={
          necitite > 0 ? `Notificări: ${necitite} necitite` : "Notificări: niciuna necitită"
        }
        className="rounded-control relative inline-flex size-11 cursor-pointer list-none items-center justify-center text-white/70 transition-colors hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {necitite > 0 ? (
          <span className="bg-danger text-danger-foreground absolute top-1.5 right-1.5 min-w-4 rounded-full px-1 font-mono text-[10px] leading-4 font-semibold tabular-nums">
            {necitite > 99 ? "99+" : necitite}
          </span>
        ) : null}
      </summary>
      <div className="border-border bg-surface text-foreground rounded-panou shadow-ridicat absolute right-0 z-40 mt-1 w-80 border p-2">
        {eroare !== null ? (
          <p className="text-danger text-nota p-2">{eroare}</p>
        ) : randuri === null ? (
          <p className="text-muted-foreground text-nota p-2">Se încarcă…</p>
        ) : randuri.length === 0 ? (
          <p className="text-muted-foreground text-nota p-2">Nicio notificare necitită.</p>
        ) : (
          <ul className="divide-border divide-y">
            {randuri.map((n) => (
              <li key={n.id}>
                {/* Direct la obiect, când se poate; altfel la listă, unde e marcată citită. */}
                <Link
                  href={n.href ?? "/notificari"}
                  className="hover:bg-background rounded-control block px-2 py-2"
                >
                  <span className="text-corp block font-medium">{n.title}</span>
                  <span className="text-muted-foreground text-nota block">
                    {formatDateTime(n.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="border-border mt-1 border-t pt-2 text-center">
          <Link href="/notificari" className="text-nota underline underline-offset-2">
            Toate notificările
          </Link>
        </p>
      </div>
    </details>
  );
}
