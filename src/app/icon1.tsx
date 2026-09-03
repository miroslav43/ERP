// src/app/icon1.tsx
import { ImageResponse } from "next/og";

/**
 * A doua iconiță a aplicației, la 192×192.
 *
 * ── DE CE EXISTĂ, DEȘI `icon.tsx` DĂ DEJA 512 ───────────────────────────────
 * Criteriul de instalare pe Android cere DOUĂ dimensiuni declarate în manifest,
 * 192 ȘI 512. Cu una singură, browserul poate refuza instalarea — și o refuză
 * TĂCUT: butonul „Instalează aplicația" pur și simplu nu apare, fără nicio
 * eroare în consolă și fără nimic în DevTools care să spună de ce. E cel mai
 * scump fel de defect din proiectul ăsta: cel care nu se plânge.
 *
 * Codul Chromium de azi acceptă, ce-i drept, orice iconiță de peste 144 px
 * (`installable_evaluator.cc`), deci 512 singură ar trece. Dar MDN, web.dev și
 * auditul Lighthouse cer explicit 192, iar o iconiță în plus costă un fișier de
 * 25 de linii. Nu se argumentează, se adaugă.
 *
 * ── NUMELE ──────────────────────────────────────────────────────────────────
 * `icon1` nu e estetic, e convenția Next pentru a doua iconiță: „You can set
 * multiple icons by adding a number suffix to the file name"
 * (`app-icons.md:64`). Ruta emisă e `/icon1` — verificată în
 * `.next/app-path-routes-manifest.json`, unde rutele de metadate de la rădăcină
 * apar cu URL curat (`/icon`, `/apple-icon`), fără hash de conținut. Proxy-ul o
 * lasă să treacă fără sesiune: `config.matcher` din `src/proxy.ts` exclude
 * explicit `icon` (vezi comentariul de deasupra lui, din același fișier).
 *
 * Zona de siguranță e aceeași ca la 512: Android decupează varianta `maskable`
 * în forma temei și taie până la 20% pe fiecare margine, deci litera stă
 * centrată la ~58% din latură. `fontSize` e scalat proporțional cu 300/512.
 */
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon192() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f1e3d",
        color: "#faf7f0",
        fontSize: 112,
        fontWeight: 700,
        letterSpacing: "-0.05em",
      }}
    >
      A
    </div>,
    size,
  );
}
