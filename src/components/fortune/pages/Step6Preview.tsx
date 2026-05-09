"use client";

import { useEffect, useMemo, useState } from "react";

import {
  readAuthStubLoggedIn,
} from "@/lib/auth-stub";
import {
  appendStubPayment,
} from "@/lib/payments-history-stub";
import {
  readWallet,
  spendableTotalCredits,
  spendCreditsForOrder,
  YEONUN_CREDIT_UPDATE_EVENT,
} from "@/lib/credit-balance-local";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Product } from "@/lib/data/content";
import type { FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import { splitHtmlAfterFirstSubtitleH3Close } from "@/lib/fortune-section-html-split";

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function previewText(prefetch: FortunePrefetchV1 | null, fallback: string) {
  if (!prefetch) return `${fallback} 풀이를 준비하고 있어요.`;
  const keys = Object.keys(prefetch.sectionHtml ?? {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const firstKey = keys.find((k) => (prefetch.sectionHtml[k] ?? "").trim().length > 0);
  const html = (firstKey != null ? prefetch.sectionHtml[firstKey] : "") || prefetch.claudeStreamHtml || "";
  const split = splitHtmlAfterFirstSubtitleH3Close(html);
  const text = stripHtml(split ? split.tail : html);
  return text.slice(0, 280).trim() || `${fallback} 풀이를 준비하고 있어요.`;
}

export function Step6Preview({
  product,
  prefetch,
  onPaid,
}: {
  product: Product;
  prefetch: FortunePrefetchV1 | null;
  onPaid: (orderNo: string | null) => void;
}) {
  const [method, setMethod] = useState<"card" | "phone" | "credit">("card");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [creditBal, setCreditBal] = useState(0);
  const [agreeAll, setAgreeAll] = useState(true);
  const [agreePayTerms, setAgreePayTerms] = useState(true);
  const [agreeCommerceTerms, setAgreeCommerceTerms] = useState(true);
  useEffect(() => {
    const refresh = () => setCreditBal(spendableTotalCredits());
    refresh();
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, refresh);
    return () => window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, refresh);
  }, []);

  const toc = useMemo(() => {
    if (product.fortune_menu.main_menus.length > 0) return product.fortune_menu.main_menus;
    return [{ id: product.slug, title: product.title, sub_menus: [] }];
  }, [product]);

  const canCredit = creditBal >= product.price_krw;
  const preview = previewText(prefetch, toc[0]?.title || product.title);

  const checkout = async (payMethod: "card" | "phone" | "credit") => {
    if (status === "loading") return;
    setMethod(payMethod);
    setStatus("loading");
    setMessage("");
    try {
      if (payMethod === "credit") {
        const spent = spendCreditsForOrder(product.price_krw);
        if (spent < product.price_krw) throw new Error("크레딧이 부족합니다.");
        if (readAuthStubLoggedIn()) {
          appendStubPayment({
            productSlug: product.slug,
            title: product.title,
            amountKrw: product.price_krw,
            method: "credit",
          });
        }
        setStatus("idle");
        onPaid(null);
        return;
      }

      const sb = supabaseBrowser();
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      const userRef = session?.user?.id ?? "guest";
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: product.slug,
          title: product.title,
          price_krw: product.price_krw,
          method: payMethod,
          user_ref: userRef,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; order?: { order_no?: string } };
      if (!res.ok || !data.success) throw new Error(data.error || "결제 요청 저장 실패");
      if (readAuthStubLoggedIn()) {
        appendStubPayment({
          productSlug: product.slug,
          title: product.title,
          amountKrw: product.price_krw,
          method: payMethod,
        });
      }
      setStatus("idle");
      onPaid(data.order?.order_no ?? null);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "결제 요청 중 오류가 발생했습니다.");
    }
  };

  const wallet = readWallet();
  const usable = Math.min(creditBal, product.price_krw);
  const extra = Math.max(0, product.price_krw - usable);
  const allChecked = agreePayTerms && agreeCommerceTerms;

  return (
    <section className="y-fortune-v2-page y-fortune-v2-preview-page y-fortune-v2-page--stack">
      <div className="y-fortune-v2-section-head">
        <h1>풀이 완성!</h1>
        <p>{product.title} 미리보기를 완성했어요</p>
      </div>
      <div className="y-fortune-v2-toc-card">
        <div className="y-fortune-v2-toc-head">전체 풀이 목차</div>
        <div>
          {toc.map((main, i) => (
            <div className="y-fortune-v2-toc-item" key={main.id}>
              <div className={`y-fortune-v2-toc-n ${i === 0 ? "open" : ""}`}>{i + 1}</div>
              <div className={`y-fortune-v2-toc-tx ${i === 0 ? "" : "lock"}`}>{main.title}</div>
              <span className={`y-fortune-v2-toc-lock ${i === 0 ? "" : "lock"}`} aria-hidden="true">
                {i === 0 ? "🔓" : "🔒"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="y-fortune-v2-preview-card">
        <div className="y-fortune-v2-prev-hd">미리보기 · {toc[0]?.title || product.title}</div>
        <div className="y-fortune-v2-prev-body">
          <div className="y-fortune-v2-prev-fade">{preview}</div>
          <div className="y-fortune-v2-blur-row">
            <div className="y-fortune-v2-lock-ico" aria-hidden="true">
              🔒
            </div>
            <div className="y-fortune-v2-lock-tx">전체 풀이를 확인하려면 결제가 필요해요</div>
          </div>
        </div>
      </div>
      <div className="y-fortune-v2-pay-card">
        {/* 결제 바텀시트(`PaymentModal`) UI를 동일 클래스/구조로 재사용 */}
        <h3 className="y-pay-section-title">결제 수단</h3>
        <div className="y-pay-methods" role="radiogroup" aria-label="결제 수단">
          <div
            className={`y-pay-method ${method === "card" ? "active" : ""}`}
            role="radio"
            aria-checked={method === "card"}
            tabIndex={0}
            onClick={() => setMethod("card")}
          >
            <div className="y-pay-method-radio" />
            <div className="y-pay-method-name">신용·체크카드</div>
            <span className="y-pay-method-icon card">CARD</span>
          </div>
          <div
            className={`y-pay-method ${method === "phone" ? "active" : ""}`}
            role="radio"
            aria-checked={method === "phone"}
            tabIndex={0}
            onClick={() => setMethod("phone")}
          >
            <div className="y-pay-method-radio" />
            <div className="y-pay-method-name">휴대폰 결제</div>
            <span className="y-pay-method-icon phone">PHONE</span>
          </div>
          <div
            className={`y-pay-method y-pay-method--credit-stack ${method === "credit" ? "active" : ""} ${creditBal < product.price_krw ? "y-pay-method--credit-blocked" : ""}`}
            role="radio"
            aria-checked={method === "credit"}
            aria-disabled={creditBal < product.price_krw}
            tabIndex={creditBal < product.price_krw ? -1 : 0}
            onClick={() => {
              if (creditBal >= product.price_krw) setMethod("credit");
            }}
          >
            <div className="y-pay-method-credit-row">
              <div className="y-pay-method-radio" />
              <div className="y-pay-method-name">크레딧 결제</div>
              <span className="y-pay-method-icon credit">CREDIT</span>
            </div>
            {creditBal < product.price_krw ? (
              <div className="y-pay-credit-short">
                잔여 {creditBal.toLocaleString("ko-KR")} 크레딧 · {extra.toLocaleString("ko-KR")} 크레딧 부족
              </div>
            ) : (
              <div className="y-pay-credit-short y-pay-credit-short--ok">잔여 {creditBal.toLocaleString("ko-KR")} 크레딧</div>
            )}
          </div>
        </div>

        <div className="y-pay-summary">
          <div className="y-pay-row">
            <span className="label">상품 금액</span>
            <span className="value">{product.price_krw.toLocaleString("ko-KR")}원</span>
          </div>
          <div className="y-pay-row discount">
            <span className="label">첫 구매 할인</span>
            <span className="value">-0원</span>
          </div>
          <div className="y-pay-total">
            <div className="y-pay-total-label">최종 결제 금액</div>
            <div className="y-pay-total-value">
              {product.price_krw.toLocaleString("ko-KR")}
              <span className="small">원</span>
            </div>
          </div>
        </div>

        <div className="y-pay-terms" aria-label="약관 동의">
          <div
            className={`y-pay-terms-row ${agreeAll && allChecked ? "checked" : ""}`}
            role="checkbox"
            aria-checked={Boolean(agreeAll && allChecked)}
            tabIndex={0}
            onClick={() => {
              const next = !(agreeAll && allChecked);
              setAgreeAll(next);
              setAgreePayTerms(next);
              setAgreeCommerceTerms(next);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              const next = !(agreeAll && allChecked);
              setAgreeAll(next);
              setAgreePayTerms(next);
              setAgreeCommerceTerms(next);
            }}
          >
            <div className="y-pay-terms-check" aria-hidden="true">
              ✓
            </div>
            <div className="text">전체 동의</div>
          </div>
          <div
            className={`y-pay-terms-row ${agreePayTerms ? "checked" : ""}`}
            role="checkbox"
            aria-checked={Boolean(agreePayTerms)}
            tabIndex={0}
            onClick={() => {
              const next = !agreePayTerms;
              setAgreePayTerms(next);
              const nextAll = next && agreeCommerceTerms;
              setAgreeAll(nextAll);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              const next = !agreePayTerms;
              setAgreePayTerms(next);
              const nextAll = next && agreeCommerceTerms;
              setAgreeAll(nextAll);
            }}
          >
            <div className="y-pay-terms-check" aria-hidden="true">
              ✓
            </div>
            <div className="text">
              [필수] <a href="/legal/terms">결제 약관</a> 동의
            </div>
          </div>
          <div
            className={`y-pay-terms-row ${agreeCommerceTerms ? "checked" : ""}`}
            role="checkbox"
            aria-checked={Boolean(agreeCommerceTerms)}
            tabIndex={0}
            onClick={() => {
              const next = !agreeCommerceTerms;
              setAgreeCommerceTerms(next);
              const nextAll = agreePayTerms && next;
              setAgreeAll(nextAll);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              const next = !agreeCommerceTerms;
              setAgreeCommerceTerms(next);
              const nextAll = agreePayTerms && next;
              setAgreeAll(nextAll);
            }}
          >
            <div className="y-pay-terms-check" aria-hidden="true">
              ✓
            </div>
            <div className="text">
              [필수] <a href="/legal/terms">전자상거래 약관</a> 동의
            </div>
          </div>
        </div>
        {message ? <p className="y-fortune-v2-pay-error">{message}</p> : null}
        <button className="y-fortune-v2-primary" type="button" disabled={status === "loading"} onClick={() => checkout(method)}>
          {status === "loading" ? "결제 처리 중..." : `전체 풀이 보기 · ${product.price_krw.toLocaleString("ko-KR")}원`}
        </button>
      </div>
    </section>
  );
}
