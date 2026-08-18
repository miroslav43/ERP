// src/app/(app)/inventar/erori.ts
// Traducerea codurilor Postgres specifice modulului de inventar — separat de
// `src/lib/actions/errors.ts` (traducerea generică), ca fiecare modul să-și
// scrie propriile mesaje fără să atingă un fișier comun altor agenți.

import { businessRule, isPostgrestError } from "@/lib/actions/errors";

/**
 * Traduce o eroare Postgres într-un mesaj de business, în română, afișabil
 * direct utilizatorului. Codurile netraduse aici sunt re-aruncate, ca
 * `createAction` să le mapeze generic prin `mapPostgrestError`.
 *
 * Tip `never`: apelul `traduEroare(error)` întrerupe fluxul exact ca un
 * `throw`, deci TypeScript îngustează corect tipul lui `data` imediat după.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23P01") {
      // `inventory_alloc_fara_suprapunere`. DETAIL-ul brut conține uuid-ul
      // celeilalte alocări și datele ei — nu se propagă către utilizator.
      throw businessRule(
        "Obiectul este deja predat unui angajat în această perioadă. Reîncărcați pagina — cineva a înregistrat o predare între timp.",
      );
    }
    if (error.code === "23505") {
      // `inventory_items_numar_uq`, pe `upper(btrim(numar_inventar))`.
      throw businessRule("Există deja un obiect cu acest număr de inventar.");
    }
    if (error.code === "P0001") {
      // Mesajele din triggerele 0010/0019 sunt scrise deja în română, pentru
      // utilizator final — de aceea se propagă, spre deosebire de restul erorilor.
      throw businessRule(error.message.slice(0, 300));
    }
  }
  throw error;
}
