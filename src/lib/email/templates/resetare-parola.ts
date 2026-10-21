// src/lib/email/templates/resetare-parola.ts
import {
  escapeHtml,
  renderButton,
  renderLayout,
  renderParagraph,
  type RenderedEmail,
  type TemplateContext,
} from "./layout";

/**
 * ── DE CE `tokenHash`, ȘI NU `token` SAU UN LINK GATA FĂCUT ─────────────────
 * Șablonul construia `${appUrl}/resetare-parola/${token}` — o rută care NU
 * EXISTĂ în aplicație. Nu era doar nefolosit: era îndreptat spre nimic.
 *
 * Prima variantă a reparației primea linkul întreg de la apelant. `templates.test.ts`
 * a respins-o, pe drept: are o poartă care cere ca ORICE link dintr-un e-mail să
 * pornească din `NEXT_PUBLIC_APP_URL`. Un șablon căruia i se dă un URL gata
 * făcut poate fi convins să trimită oriunde.
 *
 * Așa că apelantul dă doar `token_hash`-ul (de la `auth.admin.generateLink()`),
 * iar destinația o compune șablonul, din `ctx.appUrl`. Linkul nu POATE ieși de
 * pe domeniul aplicației — și tocmai de aceea niciun `Site URL` greșit din
 * proiectul Supabase nu-l mai poate trimite pe `localhost`.
 */
export type ResetareParolaData = Readonly<{
  nume: string;
  tokenHash: string;
  valabilMinute: number;
}>;

export const renderResetareParola = (
  data: ResetareParolaData,
  ctx: TemplateContext,
): RenderedEmail => {
  const link =
    `${ctx.appUrl}/auth/callback?token_hash=${encodeURIComponent(data.tokenHash)}` +
    `&type=recovery&next=${encodeURIComponent("/parola-noua")}`;
  const subject = "Resetarea parolei dumneavoastră Administrativo";
  const bodyHtml =
    `<h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;color:#12203c;">Resetare parolă</h1>` +
    renderParagraph(
      `Bună ziua, ${escapeHtml(data.nume)}. Am primit o cerere de resetare a parolei pentru contul dumneavoastră.`,
    ) +
    renderButton(link, "Setează o parolă nouă", ctx.appUrl) +
    renderParagraph(
      `Linkul expiră în <strong>${String(data.valabilMinute)} de minute</strong> și poate fi folosit o singură dată.`,
    ) +
    renderParagraph(
      "Dacă nu dumneavoastră ați cerut resetarea, nu trebuie să faceți nimic: parola actuală rămâne neschimbată.",
    ) +
    renderParagraph(
      `Adresa completă:<br /><span style="color:#1d4ed8;word-break:break-all;">${escapeHtml(link)}</span>`,
    );
  const text = [
    "Resetare parolă",
    "",
    `Bună ziua, ${data.nume}. Am primit o cerere de resetare a parolei pentru contul dumneavoastră.`,
    "",
    `Setează o parolă nouă: ${link}`,
    "",
    `Linkul expiră în ${String(data.valabilMinute)} de minute și poate fi folosit o singură dată.`,
    "Dacă nu dumneavoastră ați cerut resetarea, ignorați acest mesaj — parola rămâne neschimbată.",
  ].join("\n");
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: "Link valabil o singură dată pentru resetarea parolei.",
      bodyHtml,
      appUrl: ctx.appUrl,
    }),
    text,
  };
};
