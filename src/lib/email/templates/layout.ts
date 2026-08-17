// src/lib/email/templates/layout.ts
// Shell HTML compatibil cu clienții de email: doar tabele, stiluri inline, max 600px,
// fără flexbox/grid, cu <meta charset="utf-8"> pentru diacritice.
export type TemplateContext = Readonly<{ appUrl: string }>;
export type RenderedEmail = Readonly<{ subject: string; html: string; text: string }>;

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** S8: tot conținutul venit de la utilizator trece pe aici înainte de a ajunge în HTML. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);

export const nl2br = (value: string): string => escapeHtml(value).replace(/\r?\n/g, "<br />");

/** Acceptă doar http/https/mailto; orice altceva (javascript:, data:) cade pe fallback. */
export const safeUrl = (candidate: string, fallback: string): string => {
  try {
    const url = new URL(candidate);
    const permis =
      url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
    return permis ? url.toString() : fallback;
  } catch {
    return fallback;
  }
};

export const renderButton = (href: string, label: string, appUrl: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>` +
  `<td bgcolor="#1d4ed8" style="border-radius:6px;">` +
  `<a href="${escapeHtml(safeUrl(href, appUrl))}" style="display:inline-block;padding:12px 26px;font-family:Arial,Helvetica,sans-serif;` +
  `font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>` +
  `</td></tr></table>`;

export const renderParagraph = (html: string): string =>
  `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">${html}</p>`;

/** Rând de tip „etichetă: valoare”, folosit în emailul intern pentru cererile de demo. */
export const renderRow = (eticheta: string, valoareHtml: string): string =>
  `<tr><td style="padding:6px 12px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;` +
  `vertical-align:top;white-space:nowrap;">${escapeHtml(eticheta)}</td>` +
  `<td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;">${valoareHtml}</td></tr>`;

export const formatDataOra = (iso: string): string => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    dateStyle: "long",
    timeStyle: "short",
  }).format(data);
};

export const renderLayout = (
  opts: Readonly<{
    title: string;
    preheader: string;
    bodyHtml: string;
    appUrl: string;
  }>,
): string =>
  `<!doctype html>
<html lang="ro"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e4e6eb;border-radius:8px;">
<tr><td style="padding:20px 32px;border-bottom:1px solid #e4e6eb;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#12203c;">Administrativo</td></tr>
<tr><td style="padding:28px 32px;">${opts.bodyHtml}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #e4e6eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">
Acest mesaj a fost trimis de Administrativo. Dacă nu îl așteptai, îl poți ignora în siguranță.<br />
<a href="${escapeHtml(opts.appUrl)}" style="color:#1d4ed8;text-decoration:underline;">${escapeHtml(opts.appUrl)}</a>
</td></tr></table></td></tr></table></body></html>`;
