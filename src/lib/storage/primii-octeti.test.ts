// src/lib/storage/primii-octeti.test.ts
//
// Cititorul capului de fișier: semnează calea SUB SESIUNEA DATĂ (RLS-ul de pe
// `storage.objects` decide dacă apelantul poate citi ce a urcat), cere doar
// primii 4 KiB și întoarce `null` la orice eșec, ca apelantul să trateze
// „nu pot citi” la fel ca „nu e ce pretinde”.

import { afterEach, describe, expect, it, vi } from "vitest";

import { clientFals } from "@/lib/teste/supabase-fals";

import { citestePrimiiOcteti } from "./primii-octeti";

const BUCKET = "org-documents";
const CALE = "org/employees/emp/abc-contract.pdf";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("citestePrimiiOcteti", () => {
  it("semnează calea sub clientul dat și citește capul cu `Range: bytes=0-4095`", async () => {
    const fals = clientFals();
    fals.raspundeStocare(BUCKET, "createSignedUrl", { data: { signedUrl: "https://semnat/obj" } });
    const spionFetch = vi.fn(async () => new Response(new Uint8Array(PDF)));
    vi.stubGlobal("fetch", spionFetch);

    const octeti = await citestePrimiiOcteti(fals.client, BUCKET, CALE);

    expect(octeti).toEqual(PDF);
    expect(fals.apeluriStocare).toEqual([
      { bucket: BUCKET, metoda: "createSignedUrl", argumente: [CALE, 60] },
    ]);
    expect(spionFetch).toHaveBeenCalledWith("https://semnat/obj", {
      headers: { Range: "bytes=0-4095" },
    });
  });

  it("semnarea refuzată (RLS sau obiect lipsă): null, fără niciun `fetch`", async () => {
    const fals = clientFals();
    fals.raspundeStocare(BUCKET, "createSignedUrl", { error: { message: "Object not found" } });
    const spionFetch = vi.fn();
    vi.stubGlobal("fetch", spionFetch);

    expect(await citestePrimiiOcteti(fals.client, BUCKET, CALE)).toBeNull();
    expect(spionFetch).not.toHaveBeenCalled();
  });

  it("răspuns HTTP neizbutit la citire: null", async () => {
    const fals = clientFals();
    fals.raspundeStocare(BUCKET, "createSignedUrl", { data: { signedUrl: "https://semnat/obj" } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    expect(await citestePrimiiOcteti(fals.client, BUCKET, CALE)).toBeNull();
  });
});
