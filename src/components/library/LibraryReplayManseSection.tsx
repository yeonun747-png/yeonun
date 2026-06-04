"use client";

import { useMemo } from "react";

import { ManseDetailPanel } from "@/components/manse/ManseDetailPanel";
import { buildSajuFingerprint } from "@/lib/fortune-saju-fingerprint";
import type { FortuneBirthPayload } from "@/lib/fortune-ux/sajuStorage";
import { readStoredSaju } from "@/lib/fortune-ux/sajuStorage";

/** 보관함 재생 — 점사 당시 본인 만세력(저장 스냅샷 우선, 레거시는 fingerprint 일치 시 로컬) */
export function LibraryReplayManseSection({
  sajuInputStored,
  sajuFingerprintStored,
}: {
  sajuInputStored?: FortuneBirthPayload | null;
  sajuFingerprintStored?: string | null;
}) {
  const sajuInput = useMemo((): FortuneBirthPayload | null => {
    if (sajuInputStored) return sajuInputStored;
    const fp = sajuFingerprintStored?.trim();
    if (!fp) return null;
    const local = readStoredSaju();
    if (!local) return null;
    if (buildSajuFingerprint(local) !== fp) return null;
    return local;
  }, [sajuInputStored, sajuFingerprintStored]);

  if (!sajuInput) return null;

  return (
    <section className="y-lib-replay-manse" aria-label="점사 당시 만세력">
      <ManseDetailPanel sajuInput={sajuInput} />
    </section>
  );
}
