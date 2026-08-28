// src/lib/email/templates/link-magic.ts
//
// Autentificarea fără parolă, trimisă de NOI, nu de mailerul Supabase.
//
// Mesajul de dinainte era cel implicit al Supabase — „Confirm your email
// address", în engleză, fără nimic din firmă — iar linkul din el se construia
// din `Site URL`-ul proiectului, care arăta către `localhost:3000`. Un
// utilizator real primea un link către calculatorul altcuiva.
import {
  escapeHtml,
  renderButton,
  renderLayout,
  renderParagraph,
  type RenderedEmail,
  type TemplateContext,
} from "./layout";

export type LinkMagicData = Readonly<{
  /** De la `auth.admin.generateLink()`. Destinația o compune șablonul. */
  tokenHash: string;
  /** Calea INTERNĂ unde ajunge după autentificare. Validată de apelant. */
  next: string;
  valabilMinute: number;
}>;

export const renderLinkMagic = (data: LinkMagicData, ctx: TemplateContext): RenderedEmail => {
  // Compus AICI, nu primit gata: vezi nota din `resetare-parola.ts`. Un link
  // construit din `ctx.appUrl` nu poate ieși de pe domeniul aplicației.
  const link =
    `${ctx.appUrl}/auth/callback?token_hash=${encodeURIComponent(data.tokenHash)}` +
    `&type=magiclink&next=${encodeURIComponent(data.next)}`;
  const subject = "Linkul tău de autentificare";
  const bodyHtml =
    `<h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;color:#12203c;">Autentificare</h1>` +
    // Fără nume: linkul magic se cere doar cu adresa, iar aplicația NU confirmă
    // dacă adresa are cont. Un „Salut, Ioana" ar spune exact ce nu comunicăm.
    renderParagraph(
      "Ai cerut un link de autentificare în Administrativo. Apasă butonul de mai jos.",
    ) +
    renderButton(link, "Intră în cont", ctx.appUrl) +
    renderParagraph(
      `Linkul expiră în <strong>${String(data.valabilMinute)} de minute</strong> și poate fi folosit o singură dată.`,
    ) +
    renderParagraph(
      "Dacă nu tu ai cerut linkul, nu trebuie să faci nimic: fără el, nimeni nu intră în cont.",
    ) +
    renderParagraph(
      `Adresa completă:<br /><span style="color:#1d4ed8;word-break:break-all;">${escapeHtml(link)}</span>`,
    );
  const text = [
    "Autentificare",
    "",
    "Ai cerut un link de autentificare în Administrativo.",
    "",
    `Intră în cont: ${link}`,
    "",
    `Linkul expiră în ${String(data.valabilMinute)} de minute și poate fi folosit o singură dată.`,
    "Dacă nu tu ai cerut linkul, ignoră acest mesaj.",
  ].join("\n");
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: "Link valabil o singură dată pentru autentificare.",
      bodyHtml,
      appUrl: ctx.appUrl,
    }),
    text,
  };
};
