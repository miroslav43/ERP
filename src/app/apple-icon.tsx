// src/app/apple-icon.tsx
import { ImageResponse } from "next/og";

/**
 * Iconița pentru ecranul de start al iPhone-ului.
 *
 * Separată de `icon.tsx` fiindcă iOS o cere la 180×180 și, spre deosebire de
 * Android, NU aplică nici mască, nici colțuri rotunjite peste ce primește — le
 * desenează el, peste imaginea plină. Deci fundalul trebuie să atingă marginea,
 * iar zona de siguranță pentru mască nu-și are rostul aici.
 *
 * Fără acest fișier, iOS pune o captură a paginii ca pictogramă pe ecranul de
 * start — de obicei un dreptunghi alb ilizibil.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        fontSize: 118,
        fontWeight: 700,
        letterSpacing: "-0.05em",
      }}
    >
      A
    </div>,
    size,
  );
}
