"use client";

import { usePathname } from "next/navigation";

import { BandaFile, Fila } from "@/components/ui/file";

/**
 * Filele setărilor de pontaj.
 *
 * Împărțirea primelor două nu e cosmetică — e chiar diferența dintre două
 * feluri de scriere. „Pontarea" salvează un rând per firmă, rescris, fără dată
 * de intrare în vigoare. „Regulile de timp" creează o VERSIUNE nouă, fiindcă o
 * lună deja calculată trebuie să rămână explicabilă cu parametrii de atunci.
 *
 * Ținute în același formular, cele două ritmuri se contaminau: pornirea
 * butonului de pontare cerea reconfirmarea a optsprezece cifre de dreptul
 * muncii și alegerea unei date.
 *
 * ── DE CE A TREIA ────────────────────────────────────────────────────────
 * „Coduri QR" nu salvează nicio setare, deci pe criteriul de mai sus n-ar avea
 * ce căuta aici. E totuși locul corect, și motivul e al omului care caută, nu
 * al datelor: codul QR se administra EXCLUSIV din „Puncte de lucru", iar din
 * pontaj nu exista nicio cale către el — doar un link către pagina de tipărit a
 * celuilalt modul. „E contraintuitiv să intru în puncte de lucru pentru QR-ul
 * de la pontaj" e reclamația exactă. O filă are adresă proprie, nume propriu și
 * se vede din bandă, deci e un LOC, nu o secțiune la care trebuie să derulezi.
 */
export function NavSetariPontaj() {
  const cale = usePathname();

  return (
    <BandaFile eticheta="Navigare setări pontaj">
      <Fila href="/pontaj/setari" activ={cale === "/pontaj/setari"}>
        Pontarea
      </Fila>
      <Fila href="/pontaj/setari/reguli" activ={cale.startsWith("/pontaj/setari/reguli")}>
        Regulile de timp
      </Fila>
      <Fila href="/pontaj/setari/coduri-qr" activ={cale.startsWith("/pontaj/setari/coduri-qr")}>
        Coduri QR
      </Fila>
    </BandaFile>
  );
}
