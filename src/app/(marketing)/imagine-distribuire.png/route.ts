// src/app/(marketing)/imagine-distribuire.png/route.ts
import { deseneazaImagineDistribuire } from "../_componente/imagine-distribuire";

/** Randată o dată, la build — la fel ca `opengraph-image.tsx`, pe care o înlocuiește. */
export const dynamic = "force-static";

export function GET(): Promise<Response> {
  return deseneazaImagineDistribuire();
}
