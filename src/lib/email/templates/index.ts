// src/lib/email/templates/index.ts
// Registrul de șabloane: funcții pure, fără acces la rețea, DB sau process.env.
import { renderBunVenit, type BunVenitData } from "./bun-venit";
import { renderCerereDemoPrimita, type CerereDemoData } from "./cerere-demo-primita";
import { renderInvitatie, type InvitatieData } from "./invitatie";
import { renderResetareParola, type ResetareParolaData } from "./resetare-parola";
import type { RenderedEmail, TemplateContext } from "./layout";

export type { RenderedEmail, TemplateContext };
export type { BunVenitData, CerereDemoData, InvitatieData, ResetareParolaData };

export const EMAIL_TEMPLATE_KEYS = [
  "invitatie",
  "resetare-parola",
  "bun-venit",
  "cerere-demo-primita",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export type EmailMessage =
  | Readonly<{ template: "invitatie"; data: InvitatieData }>
  | Readonly<{ template: "resetare-parola"; data: ResetareParolaData }>
  | Readonly<{ template: "bun-venit"; data: BunVenitData }>
  | Readonly<{ template: "cerere-demo-primita"; data: CerereDemoData }>;

export const renderEmail = (message: EmailMessage, ctx: TemplateContext): RenderedEmail => {
  switch (message.template) {
    case "invitatie":
      return renderInvitatie(message.data, ctx);
    case "resetare-parola":
      return renderResetareParola(message.data, ctx);
    case "bun-venit":
      return renderBunVenit(message.data, ctx);
    case "cerere-demo-primita":
      return renderCerereDemoPrimita(message.data, ctx);
  }
};

export const TEMPLATE_LABELS: Readonly<Record<EmailTemplateKey, string>> = {
  invitatie: "Invitație în organizație",
  "resetare-parola": "Resetare parolă",
  "bun-venit": "Bun venit",
  "cerere-demo-primita": "Cerere demo (echipă)",
};

export const isTemplateKey = (value: string): value is EmailTemplateKey =>
  (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value);

/** Date exemplu pentru previzualizarea din Super-Admin (nu se trimit niciodată). */
export const SAMPLE_MESSAGES: Readonly<Record<EmailTemplateKey, EmailMessage>> = {
  invitatie: {
    template: "invitatie",
    data: {
      organizatie: "Șantierul Mureș SRL",
      invitatDe: "Ana Ionescu",
      rolEticheta: "Manager",
      token: "exemplu-token",
      expiraLa: "2026-01-15T12:00:00.000Z",
    },
  },
  "resetare-parola": {
    template: "resetare-parola",
    data: { nume: "Ioana Țîrlea", token: "exemplu-token", valabilMinute: 60 },
  },
  "bun-venit": {
    template: "bun-venit",
    data: { nume: "Ioana Țîrlea", organizatie: "Șantierul Mureș SRL", rolEticheta: "Angajat" },
  },
  "cerere-demo-primita": {
    template: "cerere-demo-primita",
    data: {
      demoId: "exemplu",
      nume: "Ana Ionescu",
      firma: "Șantierul Mureș SRL",
      email: "ana@exemplu.ro",
      telefon: "0740 000 000",
      nrAngajati: "10-49",
      mesaj: "Ne interesează pontajul și concediile.",
    },
  },
};
