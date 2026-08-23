// src/app/(app)/pontaj/interval-noapte.ts
// Fereastra de noapte a organizației, propagată din pagină până în celula de
// pontaj. Tip propriu, într-un fișier fără `"use client"`/`"use server"`, ca
// să poată fi importat din amândouă părțile graniței.

export interface IntervalNoapte {
  /** `"22:00"` — începutul ferestrei de noapte. */
  readonly start: string;
  /** `"06:00"` — sfârșitul ei; mai mic decât `start` când trece peste miezul nopții. */
  readonly sfarsit: string;
}
