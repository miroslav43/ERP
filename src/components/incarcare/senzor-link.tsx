// src/components/incarcare/senzor-link.tsx
"use client";

import { useLinkStatus } from "next/link";

import { useSemnalIncarcare } from "./use-incarcare";

/**
 * Senzorul de navigare prin `<Link>`. Nu randează nimic.
 *
 * `useLinkStatus` (Next 16.3, declarat la `next/dist/client/link.d.ts:117`) cere
 * să fii DESCENDENT al unui `<Link>` — de aici forma ciudată de „componentă
 * goală pusă înăuntru":
 *
 *   <Link href={...}>
 *     Salarizare
 *     <SenzorLink eticheta="salarizarea" />
 *   </Link>
 *
 * Nu întoarce `null`, ci un `<span hidden>`: un component care întoarce `null`
 * dintr-un `<Link>` e corect, dar `hidden` face vizibilă intenția la citirea
 * JSX-ului și lasă un cârlig pentru depanare în inspector.
 *
 * Dacă ruta-destinație a fost deja prefetch-uită, `pending` nici nu se aprinde —
 * exact comportamentul dorit: nu vrem voal peste o navigare instantanee.
 */
export function SenzorLink({
  eticheta,
}: Readonly<{ eticheta?: string | undefined }>): React.ReactElement {
  const { pending } = useLinkStatus();
  useSemnalIncarcare(pending, eticheta);
  return <span hidden aria-hidden="true" />;
}
