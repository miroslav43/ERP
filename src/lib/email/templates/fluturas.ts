// src/lib/email/templates/fluturas.ts
// Fluturașul de salariu, trimis pe e-mail cu PDF-ul atașat.
//
// Ce NU conține mesajul, deliberat: NICIO CIFRĂ. Nici brutul, nici netul, nici
// restul de plată. Salariul e o dată personală, iar corpul unui e-mail trece
// prin providerul de trimitere, prin serverul de mail al destinatarului și
// rămâne în arhive peste care nu avem niciun control. Cifrele stau în PDF-ul
// atașat; mesajul spune doar CĂ a fost emis și pentru ce lună.
import {
  escapeHtml,
  renderButton,
  renderLayout,
  renderParagraph,
  type RenderedEmail,
  type TemplateContext,
} from "./layout";

export type FluturasData = Readonly<{
  nume: string;
  organizatie: string;
  /** Luna în litere, ca pe document: „septembrie”. */
  luna: string;
  an: number;
}>;

export const renderFluturas = (data: FluturasData, ctx: TemplateContext): RenderedEmail => {
  const link = `${ctx.appUrl}/portal/salariul-meu`;
  const perioada = `${data.luna} ${String(data.an)}`;
  const subject = `Fluturașul de salariu — ${perioada}`;
  const bodyHtml =
    `<h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;color:#12203c;">Fluturașul pe ${escapeHtml(perioada)}</h1>` +
    renderParagraph(`Bună, ${escapeHtml(data.nume)},`) +
    renderParagraph(
      `Fluturașul tău de salariu pentru <strong>${escapeHtml(perioada)}</strong> este gata. Îl găsești atașat acestui mesaj, în format PDF.`,
    ) +
    renderParagraph(
      "Îl poți descărca oricând și din portal, împreună cu cei din lunile anterioare.",
    ) +
    renderButton(link, "Deschide „Salariul meu”", ctx.appUrl) +
    renderParagraph(
      `Dacă o cifră nu îți este clară, scrie-le colegilor de la resurse umane din ${escapeHtml(data.organizatie)} — au calculul complet, pas cu pas.`,
    );
  const text = [
    `Fluturașul pe ${perioada}`,
    "",
    `Bună, ${data.nume},`,
    `Fluturașul tău de salariu pentru ${perioada} este atașat acestui mesaj, în format PDF.`,
    "",
    `Îl poți descărca oricând și din portal: ${link}`,
    "",
    `Dacă o cifră nu îți este clară, scrie-le colegilor de la resurse umane din ${data.organizatie}.`,
  ].join("\n");
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `Fluturașul pe ${perioada} este atașat.`,
      bodyHtml,
      appUrl: ctx.appUrl,
    }),
    text,
  };
};
