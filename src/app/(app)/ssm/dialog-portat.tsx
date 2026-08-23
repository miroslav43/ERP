"use client";

import { createPortal } from "react-dom";
import type { ReactElement } from "react";

import { Dialog, type PropsDialog } from "@/components/ui/dialog";

/**
 * `<Dialog>` mutat în `document.body`, pentru dialogurile pornite dintr-un rând
 * de tabel.
 *
 * ── DE CE NU MERGE DIRECT ÎN CELULĂ ───────────────────────────────────────
 * Sub 768px, `<Tabel>` randează aceleași metadate ca listă de carduri, iar
 * celulele `peTelefon="meta"` intră toate într-un singur `<p>` (vezi
 * `CardRand` din `src/components/ui/tabel.tsx`). `<dialog>` e unul dintre
 * elementele care ÎNCHID un `<p>` deschis în parserul HTML — alături de `div`,
 * `table`, `section`. Adică marcajul trimis de server, `<p>…<dialog>…</dialog>…</p>`,
 * ar fi fost recitit de browser ca `<p>…</p><dialog>…</dialog>…`: alt arbore
 * decât cel construit de React, deci nepotrivire de hidratare pe fiecare rând,
 * pe telefon — exact dispozitivul pe care se folosește modulul, prin hală.
 *
 * ── DE CE NU E NEVOIE DE UN INDICATOR „montat" ────────────────────────────
 * Se randează `null` cât timp dialogul e închis, iar starea `deschis` pornește
 * mereu de la `false`. Prima randare de server și prima randare de client dau
 * amândouă `null`, deci nu există nimic de potrivit; portalul apare abia după
 * o apăsare, adică după montare, când `document` există sigur.
 */
export function DialogPortat(props: PropsDialog): ReactElement | null {
  if (!props.deschis || typeof document === "undefined") return null;
  return createPortal(<Dialog {...props} />, document.body);
}
