"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { MascotGuide } from "@/components/fortune/MascotGuide";
import type { FortuneFlowForm, FortuneGuideState, FortuneResultState, FortuneStep, SlideDirection } from "@/components/fortune/fortuneFlowTypes";
import { Step0Welcome } from "@/components/fortune/pages/Step0Welcome";
import { Step1Input } from "@/components/fortune/pages/Step1Input";
import { Step2CharIntro } from "@/components/fortune/pages/Step2CharIntro";
import { Step3Myungsik } from "@/components/fortune/pages/Step3Myungsik";
import { Step4Ohaeng } from "@/components/fortune/pages/Step4Ohaeng";
import { Step5Questions } from "@/components/fortune/pages/Step5Questions";
import { Step6Preview } from "@/components/fortune/pages/Step6Preview";
import { Step7Result } from "@/components/fortune/pages/Step7Result";
import { fortuneResultFromPrefetch, useFortuneResultStream } from "@/components/fortune/useFortuneResultStream";
import type { Character } from "@/lib/data/characters";
import type { Product } from "@/lib/data/content";
import type { DemoProfile } from "@/lib/fortune-two-stage-demo";
import { fortunePrefetchStorageKey, readFortunePrefetch, type FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import { runFortunePrefetch } from "@/lib/fortune-ux/runFortunePrefetch";
import { persistYeonunSajuV1, readStoredSaju } from "@/lib/fortune-ux/sajuStorage";
import { DEFAULT_FORTUNE_QUESTIONS } from "@/lib/fortune-ux/defaultQuestions";
import { computeManseFromFormInput, type ManseRyeokData } from "@/lib/manse-ryeok";
import { parseProductFortuneQuestions } from "@/lib/product-fortune-questions";
import { joinSectionHtmlForLibrarySave } from "@/lib/fortune-saved-html-toc";
import { YEON, UN } from "@/components/mascot/mascotAssets";

const STEP_SUBTITLE: Record<FortuneStep, string> = {
  0: "별하선생님의 인연풀이",
  1: "생년월일 입력",
  2: "별하선생님 소개",
  3: "사주 명식",
  4: "오행 분석",
  5: "별하선생님 질문",
  6: "풀이 완성",
  7: "풀이 결과",
};

function defaultForm(): FortuneFlowForm {
  return {
    name: "",
    calendarType: "solar",
    year: "",
    month: "",
    day: "",
    hour: "",
    minute: "00",
    gender: "female",
  };
}

function resultHtmlForSave(result: FortuneResultState) {
  if (result.claudeMode) return result.claudeHtml;
  return result.toc.length
    ? joinSectionHtmlForLibrarySave(result.sectionHtml, result.toc)
    : Object.keys(result.sectionHtml)
        .map(Number)
        .sort((a, b) => a - b)
        .map((i) => result.sectionHtml[i] ?? "")
        .join("\n");
}

function guideForStep(step: FortuneStep, mascot: "yeon" | "un", characterName: string, userName: string, manse: ManseRyeokData | null): FortuneGuideState {
  const name = mascot === "yeon" ? "연이" : "운이";
  const idle = mascot === "yeon" ? YEON.idle : UN.idle;
  const day = manse?.day;
  const displayName = userName || "회원";
  const base: Record<FortuneStep, Omit<FortuneGuideState, "mascot" | "name">> = {
    0: { pos: "welcome", text: "이전에 저장된 정보가 있어요! 🌸 이걸로 봐드릴까요?", clip: idle },
    1: { pos: "tl", text: "생년월일을 알려주세요! 🌸 정확할수록 좋아요", clip: idle },
    2: { pos: "mr", text: `${characterName}선생님을 소개할게요! 🌸 정말 특별한 분이에요`, clip: idle },
    3: { pos: "tr", text: `${displayName}님의 명식은 아래와 같아요 🌙`, clip: idle },
    4: { pos: "tr", text: "목(木) 기운이 가득해요! 🌸 흥미로운 명식이에요", clip: idle },
    5: { pos: "tr", text: `${characterName}선생님이 여쭤봐요 🌸 솔직하게 답해주세요!`, clip: idle },
    6: { pos: "tr", text: `${characterName}선생님 풀이 완성! 🌸 나머지도 정말 인상적이에요`, clip: idle },
    7: { pos: "rt", text: "첫 번째 풀이예요 🌙 천천히 읽어보세요", clip: idle },
  };
  if (step === 3 && day) {
    base[3] = { ...base[3], text: `${day.gan}${day.ji} 일주... 강한 분이세요 🌙` };
  }
  return { mascot, name, ...base[step] };
}

export function FortunePage({
  product,
  character,
  themeKey,
  backRaw,
}: {
  product: Product;
  character: Character | null;
  themeKey: string;
  backRaw?: string;
}) {
  const router = useRouter();
  const profile = (product.saju_input_profile === "pair" ? "pair" : "single") as DemoProfile;
  const characterName = character?.name?.trim() || product.character_key;
  const rawFortuneQuestions = (product as unknown as { fortune_questions?: unknown }).fortune_questions;
  const questions = useMemo(
    () => parseProductFortuneQuestions(rawFortuneQuestions || DEFAULT_FORTUNE_QUESTIONS),
    [rawFortuneQuestions],
  );
  const [step, setStep] = useState<FortuneStep>(0);
  const [direction, setDirection] = useState<SlideDirection>("forward");
  const [stored, setStored] = useState<FortuneFlowForm | null>(null);
  const [form, setForm] = useState<FortuneFlowForm>(() => defaultForm());
  const [manse, setManse] = useState<ManseRyeokData | null>(null);
  const [prefetch, setPrefetch] = useState<FortunePrefetchV1 | null>(null);
  const [result, setResult] = useState<FortuneResultState | null>(null);
  const [pendingOrderNo, setPendingOrderNo] = useState<string | null>(null);
  const [resultStreamEnabled, setResultStreamEnabled] = useState(false);
  const [episode, setEpisode] = useState(0);
  const [guideTextOverride, setGuideTextOverride] = useState<string | null>(null);
  const [stageReady, setStageReady] = useState(false);
  const [guideTop, setGuideTop] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const savedResultRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mascot, setMascot] = useState<"yeon" | "un">("yeon");
  const resultStream = useFortuneResultStream({
    enabled: resultStreamEnabled,
    productSlug: product.slug,
    title: product.title,
    characterKey: product.character_key,
    profile,
    orderNo: pendingOrderNo,
    onPatch: setPrefetch,
  });

  /** 상품(점사) 진입할 때마다 연이/운이 중 하나 — 같은 세션에 재방문해도 다시 랜덤 (sessionStorage 고정 제거) */
  useLayoutEffect(() => {
    setMascot(Math.random() < 0.5 ? "yeon" : "un");
  }, [product.slug]);

  useEffect(() => {
    const prev = readStoredSaju();
    setStored(prev);
    setPrefetch(readFortunePrefetch(product.slug));
    if (!prev) {
      setStep(1);
    }
    return () => abortRef.current?.abort();
  }, [product.slug]);

  useEffect(() => {
    if (step !== 6 || prefetch?.complete) return undefined;
    const t = window.setInterval(() => setPrefetch(readFortunePrefetch(product.slug)), 800);
    return () => window.clearInterval(t);
  }, [prefetch?.complete, product.slug, step]);

  /** Step 6에서만 prefetch state를 폴링하므로, Step 7에서는 sessionStorage 증분을 result에 반영해야 함 */
  useEffect(() => {
    if (step !== 7 || result?.complete) return undefined;
    const t = window.setInterval(() => {
      const p = readFortunePrefetch(product.slug);
      const next = fortuneResultFromPrefetch(p, profile, pendingOrderNo, true);
      if (next) {
        setResult(next);
        if (next.complete) setResultStreamEnabled(false);
      }
    }, 400);
    return () => window.clearInterval(t);
  }, [pendingOrderNo, product.slug, profile, result?.complete, step]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // 메뉴카드 진입 시 브라우저 스크롤 복원(이전 페이지 Y)이 적용되는 케이스를 차단
  useLayoutEffect(() => {
    const h = globalThis.history as History | undefined;
    if (!h || typeof h.scrollRestoration !== "string") return undefined;
    const prev = h.scrollRestoration;
    h.scrollRestoration = "manual";
    // 다음 프레임/마이크로태스크에서도 한 번 더 top으로 고정
    const r1 = globalThis.requestAnimationFrame?.(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" })) ?? 0;
    const t1 = window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
    return () => {
      h.scrollRestoration = prev;
      try { if (typeof globalThis.cancelAnimationFrame === "function") globalThis.cancelAnimationFrame(r1); } catch {}
      window.clearTimeout(t1);
    };
  }, []);

  useLayoutEffect(() => {
    if (step !== 0) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  const syncGuideTop = useCallback(() => {
    // 마스코트는 항상 헤더(56px) 직하단(60px)에 고정한다.
    // "헤더~정보요소 사이 가운데" 자동 보정은 Step3 처럼 갭이 큰 화면에서 헤더와의 빈 공간을 키우는 부작용이 있어 제거.
    // 정보요소와의 겹침은 step별 page--stack 의 padding-top 으로 충분히 확보된다.
    if (step > 6) return;
    setGuideTop(60);
  }, [step]);

  const onMascotArrive = useCallback(() => {
    setStageReady(true);
    window.requestAnimationFrame(syncGuideTop);
  }, [syncGuideTop]);

  useLayoutEffect(() => {
    const raf = window.requestAnimationFrame(syncGuideTop);
    window.addEventListener("resize", syncGuideTop);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", syncGuideTop);
    };
  }, [characterName, direction, episode, form.name, guideTextOverride, manse, prefetch?.complete, stageReady, step, syncGuideTop]);

  useEffect(() => {
    if (!resultStream.result) return;
    setResult(resultStream.result);
    if (resultStream.result.complete) setResultStreamEnabled(false);
  }, [resultStream.result]);

  useEffect(() => {
    if (step !== 7 || !result?.complete || savedResultRef.current) return;
    const html = resultHtmlForSave(result);
    if (!html.trim()) return;
    savedResultRef.current = true;
    void fetch("/api/fortune/save-modal-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_slug: product.slug,
        order_no: result.orderNo ?? undefined,
        character_key: product.character_key,
        profile,
        title: product.title,
        html,
        toc_sections: result.toc,
        ...(result.tocGroups ? { toc_groups: result.tocGroups } : {}),
      }),
    }).catch(() => {
      savedResultRef.current = false;
    });
  }, [product, profile, result, step]);

  const go = useCallback((next: FortuneStep, dir: SlideDirection = "forward") => {
    setDirection(dir);
    setStageReady(false);
    setStep(next);
    // Step6/7는 stage 내부 스크롤이므로 window 만 0 으로 올리면 효과가 없다.
    // stage 엘리먼트를 직접 0 으로 올리고, document 기준 스크롤도 함께 정리한다.
    const scrollAllToTop = () => {
      const stage = rootRef.current?.querySelector<HTMLElement>(".y-fortune-v2-stage");
      if (stage) stage.scrollTo({ top: 0, behavior: "auto" });
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    window.setTimeout(scrollAllToTop, 0);
    window.setTimeout(scrollAllToTop, 80);
  }, []);

  const startPrefetch = useCallback(
    (payload: FortuneFlowForm) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      persistYeonunSajuV1(payload);
      try {
        sessionStorage.removeItem(fortunePrefetchStorageKey(product.slug));
      } catch {
        // ignore
      }
      setPrefetch(null);
      void runFortunePrefetch({
        productSlug: product.slug,
        title: product.title,
        characterKey: product.character_key,
        profile,
        signal: ac.signal,
        onPatch: setPrefetch,
      });
    },
    [product.character_key, product.slug, product.title, profile],
  );

  const computeAndStart = useCallback(
    (payload: FortuneFlowForm) => {
      const hour = (payload.hour ?? "").trim();
      let minute = (payload.minute ?? "").trim();
      if (hour !== "") {
        let m = parseInt(minute || "0", 10);
        if (!Number.isFinite(m) || m < 0) m = 0;
        if (m > 59) m = 59;
        minute = String(m).padStart(2, "0");
      } else {
        minute = "00";
      }
      const normalized = { ...payload, hour, minute };
      const r = computeManseFromFormInput({
        userYear: normalized.year,
        userMonth: normalized.month,
        userDay: normalized.day,
        userBirthHour: hour !== "" ? hour : null,
        userBirthMinute: minute,
        userCalendarType: normalized.calendarType,
        userName: normalized.name,
      });
      if (!r) return false;
      setForm(normalized);
      setManse(r.manse);
      startPrefetch(normalized);
      return true;
    },
    [startPrefetch],
  );

  const onUseStored = () => {
    if (!stored) return;
    if (computeAndStart(stored)) go(2);
  };

  const onInputSubmit = () => {
    if (computeAndStart(form)) go(2);
  };

  const onAnswer = (id: string, answer: string) => {
    try {
      const key = `yeonun_fortune_quiz_${product.slug}`;
      const prev = JSON.parse(sessionStorage.getItem(key) || "{}") as Record<string, string>;
      sessionStorage.setItem(key, JSON.stringify({ ...prev, [id]: answer }));
    } catch {
      // ignore
    }
    setGuideTextOverride("좋아요. 이 답변은 풀이 뒤 코멘트에만 살짝 반영할게요.");
    window.setTimeout(() => setGuideTextOverride(null), 1300);
  };

  const onPaid = (orderNo: string | null) => {
    setPendingOrderNo(orderNo);
    const p = readFortunePrefetch(product.slug) || prefetch;
    const next = fortuneResultFromPrefetch(p, profile, orderNo, true);
    if (next) {
      setResult(next);
      if (!next.complete) setResultStreamEnabled(true);
      go(7);
      return;
    }
    setResult(null);
    setResultStreamEnabled(true);
    go(7);
  };

  const onBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    const prev = Math.max(0, step - 1) as FortuneStep;
    go(prev, "back");
  };

  const guide = useMemo(() => {
    const base = guideForStep(step, mascot, characterName, form.name, manse);
    return guideTextOverride ? { ...base, text: guideTextOverride } : base;
  }, [characterName, form.name, guideTextOverride, manse, mascot, step]);

  const headerBackHref = backRaw ? (() => {
    try {
      return decodeURIComponent(backRaw);
    } catch {
      return backRaw;
    }
  })() : `/content/${product.slug}${themeKey ? `?ck=${encodeURIComponent(themeKey)}` : ""}`;

  return (
    <div
      ref={rootRef}
      className="y-fortune-v2-root"
      data-step={step}
      style={guideTop == null ? undefined : ({ "--fortune-v2-guide-top": `${guideTop}px` } as CSSProperties)}
    >
      <header className="y-fortune-v2-header">
        <button className="y-fortune-v2-back" type="button" onClick={onBack} aria-label="뒤로">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18 L9 12 L15 6" />
          </svg>
        </button>
        <div className="y-fortune-v2-header-title">
          <h1>{product.title}</h1>
          <p>{STEP_SUBTITLE[step]}</p>
        </div>
        <Link className="y-fortune-v2-header-link" href={headerBackHref} aria-label="상품으로 이동" />
      </header>
      <main className={`y-fortune-v2-stage y-fortune-v2-stage--${direction} ${stageReady ? "is-ready" : "is-walking"}`}>
        {/* Step6/7은 내부 스크롤(stage)이라 마스코트/말풍선도 함께 스크롤되도록 stage 안에 둔다 */}
        {/* 마스코트는 화면 요소 위를 '걷는' 오버레이이므로, 특정 레이아웃(top-center) 강제는 끈다. */}
        <MascotGuide guide={guide} onArrive={onMascotArrive} layoutTopCenter={false} />
        {step === 0 ? <Step0Welcome stored={stored} onUseStored={onUseStored} onNew={() => go(1)} /> : null}
        {step === 1 ? <Step1Input form={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} onSubmit={onInputSubmit} /> : null}
        {step === 2 ? (
          <Step2CharIntro
            product={product}
            character={character}
            episode={episode}
            onNextEpisode={() => {
              if (episode >= 2) go(3);
              else setEpisode((v) => v + 1);
            }}
          />
        ) : null}
        {step === 3 && manse ? (
          <Step3Myungsik
            name={form.name || "회원"}
            manse={manse}
            onPillarTalk={setGuideTextOverride}
            onNext={() => go(4)}
          />
        ) : null}
        {step === 4 && manse ? <Step4Ohaeng manse={manse} onNext={() => go(5)} /> : null}
        {step === 5 ? <Step5Questions characterName={characterName} questions={questions} onAnswer={onAnswer} onDone={() => go(6)} /> : null}
        {step === 6 ? (
          <Step6Preview product={product} prefetch={prefetch} waiting={!prefetch?.complete} onPaid={onPaid} />
        ) : null}
        {step === 7 && result ? (
          <Step7Result
            product={product}
            result={result}
            onGuide={(mainTitle) => setGuideTextOverride(`${mainTitle} 풀이로 넘어갈게요 🌙 천천히 읽어보세요`)}
            onAllDone={() => setGuideTextOverride("풀이가 모두 끝났어요 🌸 오늘의 마음을 잘 간직해 주세요")}
          />
        ) : null}
        {step === 7 && !result ? (
          <div className="y-fortune-v2-result-loading">
            <span />
            <h2>풀이를 여는 중이에요.</h2>
            <p>
              {resultStream.phase === "error"
                ? resultStream.error || "풀이 스트림 연결에 실패했습니다. 잠시 후 다시 시도해 주세요."
                : "첫 번째 대메뉴가 도착하는 즉시 바로 보여드릴게요."}
            </p>
            {resultStream.phase === "error" ? (
              <button type="button" className="y-fortune-v2-primary" onClick={() => resultStream.start()}>
                다시 불러오기
              </button>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
