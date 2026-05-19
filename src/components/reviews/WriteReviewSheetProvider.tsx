"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { submitUserArchiveReview } from "@/lib/reviews-archive-client";
import {
  REVIEW_TAG_OPTIONS,
  USER_REVIEWS_CHANGED_EVENT,
  reviewQuestion,
  reviewStarHint,
  showYeonunToast,
  type ReviewSourceType,
  type UserReviewRecord,
} from "@/lib/reviews-user";
import { characterGlyph, type CharacterReviewKey } from "@/lib/reviews-types";
import { onMissionReviewSubmitted } from "@/lib/mission-complete";
import { supabaseBrowser } from "@/lib/supabase/client";

export type WriteReviewTarget = {
  sourceType: ReviewSourceType;
  sourceId: string;
  productSlug: string;
  characterKey: CharacterReviewKey;
  productLine: string;
  title: string;
  subline: string;
};

type WriteReviewContextValue = {
  openWriteReview: (target: WriteReviewTarget) => void;
  openViewReview: (target: WriteReviewTarget, record: UserReviewRecord) => void;
};

const WriteReviewContext = createContext<WriteReviewContextValue | null>(null);

export function useWriteReviewSheet() {
  const ctx = useContext(WriteReviewContext);
  if (!ctx) {
    throw new Error("useWriteReviewSheet must be used within WriteReviewSheetProvider");
  }
  return ctx;
}

export function WriteReviewSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"write" | "view">("write");
  const [target, setTarget] = useState<WriteReviewTarget | null>(null);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const historyPushedRef = useRef(false);

  const openWriteReview = useCallback((next: WriteReviewTarget) => {
    setTarget(next);
    setMode("write");
    setStars(0);
    setBody("");
    setSelectedTags([]);
    setOpen(true);
  }, []);

  const openViewReview = useCallback((next: WriteReviewTarget, record: UserReviewRecord) => {
    setTarget(next);
    setMode("view");
    setStars(record.stars);
    setBody(record.body);
    setSelectedTags(record.tags);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    if (historyPushedRef.current) {
      window.history.back();
      return;
    }
    setOpen(false);
    setMode("write");
  }, []);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ yWriteReview: 1 }, "");
    historyPushedRef.current = true;

    const onPopState = () => {
      historyPushedRef.current = false;
      setOpen(false);
      setMode("write");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const submit = useCallback(async () => {
    if (!target || stars < 1 || submitting) return;

    const sb = supabaseBrowser();
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    if (!session?.access_token) {
      showYeonunToast("로그인 후 리뷰를 등록할 수 있어요");
      return;
    }

    setSubmitting(true);
    const result = await submitUserArchiveReview(session.access_token, {
      sourceType: target.sourceType,
      sourceId: target.sourceId,
      productSlug: target.productSlug,
      stars,
      body: body.trim(),
      tags: selectedTags,
      characterKey: target.characterKey,
      productLine: target.productLine,
      title: target.title,
    });
    setSubmitting(false);

    if (!result.ok) {
      showYeonunToast("리뷰 저장에 실패했어요. 잠시 후 다시 시도해 주세요");
      return;
    }

    window.dispatchEvent(
      new CustomEvent(USER_REVIEWS_CHANGED_EVENT, { detail: { review: result.review } }),
    );
    void onMissionReviewSubmitted();
    close();
    showYeonunToast("리뷰가 등록됐어요 ✓");
  }, [body, close, selectedTags, stars, submitting, target]);

  const ctx = useMemo(() => ({ openWriteReview, openViewReview }), [openWriteReview, openViewReview]);

  const question = target ? reviewQuestion(target.sourceType) : "";
  const hint = reviewStarHint(stars);
  const glyph = target ? characterGlyph(target.characterKey) : "緣";
  const readOnly = mode === "view";

  const onOverlayMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) close();
  };

  return (
    <WriteReviewContext.Provider value={ctx}>
      {children}
      {open && target ? (
        <YeonunSheetPortal lockScroll>
          <div
            className="y-rv-overlay open"
            role="dialog"
            aria-modal="true"
            aria-label={readOnly ? "내 리뷰 보기" : "리뷰 작성"}
            onMouseDown={onOverlayMouseDown}
          >
            <div className={`y-rv-sheet${readOnly ? " y-rv-sheet--view" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
              <button type="button" className="y-rv-close" onClick={close} aria-label="닫기">
                {"\u00d7"}
              </button>
              <div className="y-rv-handle" aria-hidden />
              <div className="y-rv-char-row">
                <div className={`y-rv-avatar ${target.characterKey}`} aria-hidden>
                  {glyph}
                </div>
                <div>
                  <div className="y-rv-prod">{target.productLine}</div>
                  <div className="y-rv-sub">{target.subline}</div>
                </div>
              </div>
              <h2 className="y-rv-q">{question}</h2>
              <div className="y-rv-stars" role="group" aria-label={readOnly ? "내 별점" : "별점 선택"}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`y-rv-star${n <= stars ? " on" : ""}`}
                    aria-label={`${n}점`}
                    disabled={readOnly}
                    tabIndex={readOnly ? -1 : 0}
                    onClick={readOnly ? undefined : () => setStars(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="y-rv-auto-msg">{hint}</p>
              <div className="y-rv-ta-wrap">
                <textarea
                  className="y-rv-ta"
                  value={body}
                  maxLength={200}
                  readOnly={readOnly}
                  tabIndex={readOnly ? -1 : 0}
                  placeholder={readOnly ? undefined : stars > 0 ? hint : "어떤 점이 좋으셨나요?"}
                  onMouseDown={readOnly ? (e) => e.preventDefault() : undefined}
                  onFocus={readOnly ? (e) => e.currentTarget.blur() : undefined}
                  onChange={readOnly ? undefined : (e) => setBody(e.target.value)}
                />
                <span className="y-rv-cnt">{body.length}/200</span>
              </div>
              <p className="y-rv-tags-label">태그 선택 (선택)</p>
              <div className="y-rv-tags">
                {REVIEW_TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`y-rv-tag${selectedTags.includes(tag) ? " on" : ""}`}
                    disabled={readOnly}
                    tabIndex={readOnly ? -1 : 0}
                    onClick={readOnly ? undefined : () => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {readOnly ? (
                <button type="button" className="y-rv-submit on y-rv-view-close" onClick={close}>
                  닫기
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={`y-rv-submit${stars > 0 ? " on" : ""}`}
                    disabled={stars < 1 || submitting}
                    onClick={() => void submit()}
                  >
                    {submitting ? "저장 중…" : "리뷰 등록하기"}
                  </button>
                  <button type="button" className="y-rv-skip" onClick={close}>
                    다음에 할게요
                  </button>
                </>
              )}
            </div>
          </div>
        </YeonunSheetPortal>
      ) : null}
    </WriteReviewContext.Provider>
  );
}
