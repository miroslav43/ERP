import { cuDe } from "@/content/legal/zile-libere";

/**
 * Numerele de zile din cerere, cu acordul românesc.
 *
 * Auditul din 8 oct 2026 a găsit în documentul de semnat „nu se numără cele 1
 * zile de weekend” și „reprezentând 250 zile lucrătoare”. Regula lui „de” (de
 * la 20 în sus, cu excepția lui 101–119, 201–219…) stă deja în `cuDe`; aici se
 * adaugă singularul și zero, pe care `cuDe` nu le tratează.
 */

/** „1 zi lucrătoare”, „5 zile lucrătoare”, „20 de zile lucrătoare”. */
export function zileLucratoareText(n: number): string {
  if (n === 0) return "nicio zi lucrătoare";
  return n === 1 ? "1 zi lucrătoare" : cuDe(n, "zile lucrătoare");
}

/** „1 zi”, „7 zile”, „30 de zile”. */
export function zileText(n: number): string {
  if (n === 0) return "0 zile";
  return n === 1 ? "1 zi" : cuDe(n, "zile");
}

/** „1 zi calendaristică”, „5 zile calendaristice”, „20 de zile calendaristice”. */
export function zileCalendaristiceText(n: number): string {
  return n === 1 ? "1 zi calendaristică" : cuDe(n, "zile calendaristice");
}

/** Ce spune cererea despre weekend: „nicio zi”, „o zi”, „cele 2 zile de weekend”. */
export function weekendText(n: number): string {
  if (n === 0) return "nicio zi de weekend";
  if (n === 1) return "o zi de weekend";
  return `cele ${cuDe(n, "zile de weekend")}`;
}

/** „nicio sărbătoare legală”, „o sărbătoare legală”, „4 sărbători legale”. */
export function sarbatoriText(n: number): string {
  if (n === 0) return "nicio sărbătoare legală";
  if (n === 1) return "o sărbătoare legală";
  return cuDe(n, "sărbători legale");
}
