// src/lib/email/templates/index.ts
// Registrul de șabloane: funcții pure, fără acces la rețea, DB sau process.env.
import { renderBunVenit, type BunVenitData } from "./bun-venit";
import { renderCerereDemoPrimita, type CerereDemoData } from "./cerere-demo-primita";
import { renderFluturas, type FluturasData } from "./fluturas";
import { renderInvitatie, type InvitatieData } from "./invitatie";
import { renderLinkMagic, type LinkMagicData } from "./link-magic";
import { renderResetareParola, type ResetareParolaData } from "./resetare-parola";
import type { RenderedEmail, TemplateContext } from "./layout";

export type { RenderedEmail, TemplateContext };
export type {
  BunVenitData,
  CerereDemoData,
  FluturasData,
  InvitatieData,
  LinkMagicData,
  ResetareParolaData,
};

export const EMAIL_TEMPLATE_KEYS = [
  "invitatie",
  "resetare-parola",
  "link-magic",
  "bun-venit",
  "cerere-demo-primita",
  "fluturas",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export type EmailMessage =
  | Readonly<{ template: "invitatie"; data: InvitatieData }>
  | Readonly<{ template: "resetare-parola"; data: ResetareParolaData }>
  | Readonly<{ template: "link-magic"; data: LinkMagicData }>
  | Readonly<{ template: "bun-venit"; data: BunVenitData }>
  | Readonly<{ template: "cerere-demo-primita"; data: CerereDemoData }>
  | Readonly<{ template: "fluturas"; data: FluturasData }>;

export const renderEmail = (message: EmailMessage, ctx: TemplateContext): RenderedEmail => {
  switch (message.template) {
    case "invitatie":
      return renderInvitatie(message.data, ctx);
    case "resetare-parola":
      return renderResetareParola(message.data, ctx);
    case "link-magic":
      return renderLinkMagic(message.data, ctx);
    case "bun-venit":
      return renderBunVenit(message.data, ctx);
    case "cerere-demo-primita":
      return renderCerereDemoPrimita(message.data, ctx);
    case "fluturas":
      return renderFluturas(message.data, ctx);
  }
};

export const TEMPLATE_LABELS: Readonly<Record<EmailTemplateKey, string>> = {
  invitatie: "Invitație în organizație",
  "resetare-parola": "Resetare parolă",
  "link-magic": "Link de autentificare",
  "bun-venit": "Bun venit",
  "cerere-demo-primita": "Cerere demo (echipă)",
  fluturas: "Fluturaș de salariu",
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
    data: {
      nume: "Ioana Țîrlea",
      tokenHash: "exemplu-token-hash",
      valabilMinute: 60,
    },
  },
  "link-magic": {
    template: "link-magic",
    data: { tokenHash: "exemplu-token-hash", next: "/", valabilMinute: 60 },
  },
  "bun-venit": {
    template: "bun-venit",
    data: { nume: "Ioana Țîrlea", organizatie: "Șantierul Mureș SRL", rolEticheta: "Angajat" },
  },
  fluturas: {
    template: "fluturas",
    data: {
      nume: "Ioana Țîrlea",
      organizatie: "Șantierul Mureș SRL",
      luna: "septembrie",
      an: 2026,
    },
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
