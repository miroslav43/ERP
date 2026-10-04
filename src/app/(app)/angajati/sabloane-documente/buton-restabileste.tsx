// src/app/(app)/angajati/sabloane-documente/buton-restabileste.tsx
"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import { ETICHETE_SABLON, esteCodInrolare } from "@/lib/documents/variabile";

import { restabilesteSablonPlatforma } from "./actions";

/**
 * Renunță la varianta firmei și revine la textul livrat cu aplicația.
 *
 * Confirmarea spune explicit ce NU se întâmplă: documentele deja emise nu se
 * schimbă. Fiecare poartă în `hr_issued_documents.continut_html` textul cu care
 * a fost emis, tocmai ca amprenta lui SHA-256 să însemne ceva. Fără propoziția
 * asta, cineva ar putea apăsa crezând că retrage și contractele semnate.
 */
export function ButonRestabilesteSablon({
  cod,
  denumire,
}: Readonly<{
  cod: string;
  /**
   * Dată doar pentru un document creat de firmă (`doc_…`). Acela nu are
   * variantă de platformă la care să se revină: retragerea lui e o ștergere,
   * iar butonul și confirmarea o spun ca atare.
   */
  denumire?: string;
}>): React.ReactElement {
  const personalizat = denumire !== undefined;
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const router = useRouter();

  const confirma = useCallback(() => {
    porneste(async () => {
      const rezultat = await restabilesteSablonPlatforma({ cod });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({
        fel: "reusita",
        text: personalizat ? "Documentul a fost șters." : "S-a revenit la șablonul de platformă.",
      });
      router.refresh();
    });
  }, [cod, personalizat, router]);

  return (
    <>
      <Buton
        varianta="tertiar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        {personalizat ? "Șterge" : "Revino la varianta de platformă"}
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={personalizat ? "Ștergerea documentului" : "Revenire la șablonul de platformă"}
        consecinta={
          personalizat
            ? `„${denumire}” nu se va mai putea emite. Documentele DEJA emise rămân în dosarele angajaților și în registru, neschimbate.`
            : `Textul scris de firmă pentru „${esteCodInrolare(cod) ? ETICHETE_SABLON[cod] : cod}” se retrage, iar emiterile următoare vor folosi din nou varianta livrată cu aplicația. Documentele DEJA emise nu se modifică: fiecare păstrează textul cu care a fost emis.`
        }
        etichetaConfirmare={personalizat ? "Șterge documentul" : "Revino la platformă"}
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
