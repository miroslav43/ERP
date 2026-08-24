// src/app/global-error.tsx
"use client";

/**
 * Ultima plasă de siguranță: eroarea a apărut în layout-ul RĂDĂCINĂ, deci
 * `<html>` și `<body>` nu mai există — acest fișier trebuie să le randeze el
 * însuși. Din același motiv nu importă `StareEroare` și nici o clasă Tailwind:
 * dacă a căzut layout-ul rădăcină, `globals.css` poate să nu fi ajuns niciodată
 * în pagină, iar un ecran stilat cu clase inexistente arată ca text nud pe fond
 * alb. Stilurile de aici sunt inline, autonome, fără nicio dependență.
 *
 * Butonul face o încărcare completă a documentului, nu `retry()` sau `reset()`:
 * când cade layout-ul rădăcină, ce trebuie refăcut e chiar documentul, cu tot
 * cu foaia de stil care poate să nu fi ajuns niciodată în pagină. `reset()`
 * era chemat înaintea reîncărcării și nu adăuga nimic — reîncărcarea îl face
 * oricum, iar dependența de numele prop-ului dispare odată cu el.
 */

import type { CSSProperties } from "react";

const fundal: CSSProperties = {
  margin: 0,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  backgroundColor: "#f6f7f9",
  color: "#111827",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  lineHeight: 1.5,
};

const panou: CSSProperties = {
  maxWidth: "34rem",
  width: "100%",
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "0.75rem",
  padding: "2rem",
  textAlign: "center",
};

const titlu: CSSProperties = { margin: 0, fontSize: "1.25rem", fontWeight: 600 };

const paragraf: CSSProperties = {
  margin: "0.75rem 0 0",
  fontSize: "0.9375rem",
  color: "#4b5563",
};

const cod: CSSProperties = {
  margin: "1rem 0 0",
  fontSize: "0.8125rem",
  color: "#6b7280",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const actiune: CSSProperties = {
  marginTop: "1.5rem",
  appearance: "none",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.625rem 1.25rem",
  fontSize: "0.9375rem",
  fontWeight: 500,
  color: "#ffffff",
  backgroundColor: "#0f1e3d",
  cursor: "pointer",
};

export default function EroareGlobala({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="ro">
      <body style={fundal}>
        <div role="alert" aria-live="assertive" style={panou}>
          <h1 style={titlu}>Aplicația nu a putut porni</h1>
          <p style={paragraf}>
            A apărut o eroare înainte ca pagina să fie construită. Reîncărcați; dacă se repetă,
            transmiteți codul de mai jos administratorului.
          </p>
          <p style={cod}>Cod incident: {error.digest ?? "indisponibil"}</p>
          <button
            type="button"
            style={actiune}
            onClick={() => {
              window.location.reload();
            }}
          >
            Reîncarcă pagina
          </button>
        </div>
      </body>
    </html>
  );
}
