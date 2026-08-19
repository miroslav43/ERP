"use client";

import { useEffect, useState } from "react";

import { marcheazaAnuntCitit } from "../actions";

/**
 * Marchează automat, o singură dată la deschiderea paginii — fără buton, fără
 * clic. Acțiunea e idempotentă (verifică rândul existent înainte de a insera),
 * deci reîncărcarea paginii nu produce confirmări duplicate.
 */
export function MarcheazaCitit({ id }: { readonly id: string }) {
  const [confirmat, setConfirmat] = useState(false);

  useEffect(() => {
    let anulat = false;
    void marcheazaAnuntCitit({ id }).then((rezultat) => {
      if (!anulat && rezultat.ok) setConfirmat(true);
    });
    return () => {
      anulat = true;
    };
  }, [id]);

  if (!confirmat) return null;
  return <p className="text-muted-foreground text-xs">Confirmat citit.</p>;
}
