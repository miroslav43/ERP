// src/app/(portal)/_components/iconite.ts
import {
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  HardHat,
  House,
  LifeBuoy,
  Megaphone,
  Package,
  Receipt,
  Wrench,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Iconițele se aleg AICI, după id, nu se primesc ca proprietăți.
 *
 * `PORTAL_NAV_ITEMS` le ține ca referințe de componentă, iar o componentă nu
 * poate traversa granița server → client ca valoare. În aplicația mare,
 * layout-ul le randează pe server ca elemente gata făcute tocmai din motivul
 * ăsta — dar acolo există o singură dimensiune. Portalul are două învelișuri:
 * rail-ul le vrea `size-4`, bara `size-5`. Randate pe server, ar fi trebuit
 * trimise de două ori, în două câmpuri. Harta pe id costă zero payload.
 *
 * Fișierul NU e „use client”: e o hartă de valori, importată de ambele bare.
 */
export const ICONITE: Readonly<Record<string, LucideIcon>> = {
  "portal-acasa": House,
  "portal-pontaj": Clock,
  "portal-concedii": CalendarDays,
  "portal-salariul": Wallet,
  "portal-documente": FileText,
  "portal-anunturi": Megaphone,
  "portal-in-primire": Package,
  "portal-instruiri": HardHat,
  "portal-sesizari": Wrench,
  "portal-tichete": LifeBuoy,
  "portal-diurna": Receipt,
  "portal-integrare": ClipboardList,
};

/** Rezervă pentru o intrare adăugată în meniu și uitată aici. */
export const IconitaImplicita: LucideIcon = House;

/**
 * Calea curentă corespunde intrării?
 *
 * `exact` există pentru „Acasă”: `/portal` e prefix pentru absolut toate
 * celelalte rute, deci cu potrivire pe prefix ar apărea activă pe fiecare
 * ecran. Pentru rest, prefixul e corect — `/portal/concediile-mele/noua`
 * trebuie să aprindă „Concediile mele”.
 */
export function esteActiva(cale: string, href: string, exact: boolean): boolean {
  if (exact) return cale === href;
  return cale === href || cale.startsWith(`${href}/`);
}
