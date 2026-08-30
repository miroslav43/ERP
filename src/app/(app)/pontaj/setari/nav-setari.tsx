"use client";

import { usePathname } from "next/navigation";

import { BandaFile, Fila } from "@/components/ui/file";

/**
 * Cele două file ale setărilor de pontaj.
 *
 * Împărțirea nu e cosmetică — e chiar diferența dintre două feluri de scriere.
 * „Pontarea" salvează un rând per firmă, rescris, fără dată de intrare în
 * vigoare. „Regulile de timp" creează o VERSIUNE nouă, fiindcă o lună deja
 * calculată trebuie să rămână explicabilă cu parametrii de atunci.
 *
 * Ținute în același formular, cele două ritmuri se contaminau: pornirea
 * butonului de pontare cerea reconfirmarea a optsprezece cifre de dreptul
 * muncii și alegerea unei date.
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
    </BandaFile>
  );
}
