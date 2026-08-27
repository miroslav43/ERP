"use client";

// src/app/(app)/cursuri/[id]/constructor-curs.tsx
//
// ── GESTUL CEL MAI FRECVENT E LA UN CLIC ──────────────────────────────────
// După primele două cursuri, construcția înseamnă ALEGERE, nu încărcare: „+”
// pe un material din bibliotecă îl adaugă la finalul cursului, fără dialog și
// fără pas intermediar.
//
// ── DELIBERAT FĂRĂ TRAGE-ȘI-LASĂ ──────────────────────────────────────────
// Pe telefon e imposibil de folosit, la tastatură e imposibil de făcut
// accesibil ieftin, și ar aduce prima dependență de interfață din proiect.
// Mutarea e `↑`/`↓`, fiecare un buton cu țintă de 44px.

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileText, Film, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { StareGoala } from "@/components/ui/stare-goala";
import { arataToast } from "@/components/ui/toast";
import type { RandLectie, RandMaterial } from "@/lib/queries/cursuri";
import { durataCitibila } from "@/domain/cursuri/scadente";

import { adaugaLectie, mutaLectie, publicaCurs, stergeLectie } from "../actions";
import { ETICHETE_FEL, ETICHETE_TREAPTA } from "../etichete";

interface Proprietati {
  readonly cursId: string;
  readonly denumire: string;
  readonly publicat: boolean;
  readonly lectii: readonly RandLectie[];
  readonly biblioteca: readonly RandMaterial[];
  readonly numarInrolati: number;
  readonly poateEdita: boolean;
}

export function ConstructorCurs({
  cursId,
  denumire,
  publicat,
  lectii,
  biblioteca,
  numarInrolati,
  poateEdita,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [confirmaPublicarea, setConfirmaPublicarea] = useState(false);

  const ruleaza = useCallback(
    (operatie: () => Promise<{ ok: boolean; error?: { message: string } }>, reusita: string) => {
      setEroare(null);
      porneste(async () => {
        const rezultat = await operatie();
        if (!rezultat.ok) {
          // Niciodată un toast verde peste un refuz: mesajul rămâne pe ecran,
          // lângă lucrul pe care omul încerca să-l facă.
          setEroare(rezultat.error?.message ?? "Operațiunea nu a reușit.");
          return;
        }
        arataToast({ fel: "reusita", text: reusita });
        router.refresh();
      });
    },
    [router],
  );

  const idLectiiFolosite = new Set(lectii.map((l) => l.material_id));
  const faraVersiune = lectii.filter((l) => !l.are_versiune);
  const obligatorii = lectii.filter((l) => l.obligatoriu).length;

  return (
    <div className="space-y-4">
      {eroare === null ? null : (
        <Callout fel="eroare" titlu="Modificarea nu s-a aplicat">
          {eroare}
        </Callout>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Structura cursului ─────────────────────────────────────────── */}
        <section aria-labelledby="titlu-structura" className="space-y-3">
          <h2 id="titlu-structura" className="text-sectiune font-medium">
            Lecțiile cursului
          </h2>

          {lectii.length === 0 ? (
            <StareGoala
              fel="initiala"
              compact
              pictograma={FileText}
              titlu="Nicio lecție"
              descriere="Adăugați materiale din bibliotecă, cu „+”. Ordinea lor e ordinea în care le parcurge angajatul."
            />
          ) : (
            <ol className="divide-border border-border rounded-panou divide-y border">
              {lectii.map((lectie, i) => (
                <li key={lectie.id} className="flex items-start gap-3 p-3">
                  <span className="text-muted-foreground text-nota mt-1 tabular-nums">
                    {i + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{lectie.titlu}</p>
                    <p className="text-muted-foreground text-nota mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{ETICHETE_FEL[lectie.fel]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ETICHETE_TREAPTA[lectie.treapta_dovada]}</span>
                      {lectie.durata_secunde === null ? null : (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{durataCitibila(lectie.durata_secunde)}</span>
                        </>
                      )}
                      {lectie.obligatoriu ? null : <Badge ton="neutru">Opțională</Badge>}
                      {lectie.are_versiune ? null : (
                        <Badge ton="pericol" cuAvertisment>
                          Fără conținut
                        </Badge>
                      )}
                    </p>
                  </div>
                  {poateEdita ? (
                    <div className="flex shrink-0 gap-1">
                      <Buton
                        varianta="tertiar"
                        marime="iconita"
                        aria-label={`Mută „${lectie.titlu}” mai sus`}
                        disabled={i === 0 || inCurs}
                        onClick={() => {
                          ruleaza(
                            () => mutaLectie({ id: lectie.id, directie: "sus" }),
                            "Ordinea a fost schimbată.",
                          );
                        }}
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </Buton>
                      <Buton
                        varianta="tertiar"
                        marime="iconita"
                        aria-label={`Mută „${lectie.titlu}” mai jos`}
                        disabled={i === lectii.length - 1 || inCurs}
                        onClick={() => {
                          ruleaza(
                            () => mutaLectie({ id: lectie.id, directie: "jos" }),
                            "Ordinea a fost schimbată.",
                          );
                        }}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </Buton>
                      <Buton
                        varianta="tertiar"
                        marime="iconita"
                        aria-label={`Scoate „${lectie.titlu}” din curs`}
                        disabled={inCurs}
                        onClick={() => {
                          ruleaza(
                            () => stergeLectie({ id: lectie.id }),
                            "Lecția a fost scoasă din curs.",
                          );
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Buton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}

          {faraVersiune.length > 0 ? (
            <Callout fel="atentie" titlu="Lecții fără conținut">
              {faraVersiune.length === 1
                ? "O lecție nu are încă un fișier sau un link încărcat. Angajatul n-ar avea ce deschide."
                : `${String(faraVersiune.length)} lecții nu au încă fișier sau link. Angajatul n-ar avea ce deschide.`}
            </Callout>
          ) : null}
        </section>

        {/* ── Biblioteca ─────────────────────────────────────────────────── */}
        <section aria-labelledby="titlu-biblioteca" className="space-y-3">
          <h2 id="titlu-biblioteca" className="text-sectiune font-medium">
            Bibliotecă
          </h2>

          {biblioteca.length === 0 ? (
            <StareGoala
              fel="initiala"
              compact
              pictograma={Film}
              titlu="Biblioteca e goală"
              descriere="Încărcați întâi un material — PDF sau film."
              actiune={{ eticheta: "Deschideți biblioteca", href: "/cursuri/biblioteca" }}
            />
          ) : (
            <ul className="divide-border border-border rounded-panou divide-y border">
              {biblioteca.map((material) => {
                const folosit = idLectiiFolosite.has(material.id);
                return (
                  <li key={material.id} className="flex items-center gap-3 p-3">
                    {material.fel === "pdf" ? (
                      <FileText
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Film className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{material.titlu}</p>
                      <p className="text-muted-foreground text-nota">
                        {ETICHETE_TREAPTA[material.treapta_dovada]}
                      </p>
                    </div>
                    {poateEdita ? (
                      <Buton
                        varianta="secundar"
                        marime="iconita"
                        aria-label={
                          folosit
                            ? `„${material.titlu}” este deja în curs`
                            : `Adaugă „${material.titlu}” la curs`
                        }
                        disabled={folosit || inCurs}
                        onClick={() => {
                          ruleaza(
                            () =>
                              adaugaLectie({
                                course_id: cursId,
                                material_id: material.id,
                                obligatoriu: true,
                              }),
                            "Lecția a fost adăugată.",
                          );
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </Buton>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {poateEdita ? (
        <BaraActiuni eticheta="Acțiuni asupra cursului" separata>
          <Buton
            varianta={publicat ? "secundar" : "primar"}
            inCurs={inCurs}
            disabled={lectii.length === 0 && !publicat}
            onClick={() => {
              if (publicat) {
                ruleaza(
                  () => publicaCurs({ id: cursId, publicat: false }),
                  "Cursul a fost retras din publicare.",
                );
              } else {
                setConfirmaPublicarea(true);
              }
            }}
          >
            {publicat ? "Retrage din publicare" : "Publică cursul"}
          </Buton>
          {lectii.length === 0 && !publicat ? (
            <p className="text-muted-foreground text-nota">
              Adăugați cel puțin o lecție înainte de publicare.
            </p>
          ) : null}
        </BaraActiuni>
      ) : null}

      {/*
        Confirmarea arată CIFRE, nu doar un „sunteți sigur?”: publicarea face
        cursul atribuibil, iar omul trebuie să vadă ce pune în mișcare.
      */}
      <ConfirmareActiune
        deschis={confirmaPublicarea}
        laInchidere={() => {
          setConfirmaPublicarea(false);
        }}
        titlu={`Publicați „${denumire}”?`}
        consecinta="După publicare, cursul poate fi atribuit angajaților. Îl puteți retrage oricând, fără să afectați înrolările deja pornite."
        cifre={[
          { eticheta: "Lecții", valoare: String(lectii.length) },
          { eticheta: "Dintre care obligatorii", valoare: String(obligatorii) },
          { eticheta: "Persoane înrolate acum", valoare: String(numarInrolati) },
        ]}
        etichetaConfirmare="Publică"
        inCurs={inCurs}
        laConfirmare={() => {
          setConfirmaPublicarea(false);
          ruleaza(() => publicaCurs({ id: cursId, publicat: true }), "Cursul a fost publicat.");
        }}
      />
    </div>
  );
}
