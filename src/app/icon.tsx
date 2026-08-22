// src/app/icon.tsx
import { ImageResponse } from "next/og";

/**
 * Iconița aplicației, generată din cod la build.
 *
 * `ImageResponse` în loc de un PNG în `public/`: nu adaugă binare în repo, iar
 * culorile rămân legate de paletă — dacă navy-ul se schimbă, iconița îl urmează
 * fără ca cineva să redeseneze un fișier. Valorile sunt scrise literal fiindcă
 * imaginea se randează în afara CSS-ului aplicației, unde `var(--color-*)` nu
 * există.
 *
 * Zona de siguranță pentru varianta `maskable`: Android decupează iconița în
 * forma temei (cerc, pătrat rotunjit, picătură), tăind până la 20% pe fiecare
 * margine. De aceea litera stă într-un pătrat centrat, la scara 60% — colțurile
 * pot dispărea fără ca ea să fie atinsă.
 */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
        fontSize: 300,
        fontWeight: 700,
        letterSpacing: "-0.05em",
      }}
    >
      A
    </div>,
    size,
  );
}
