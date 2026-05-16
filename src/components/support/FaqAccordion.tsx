"use client";

import { Fragment, useCallback, useId, useState } from "react";

import { SUPPORT_FAQ_EMAIL, SUPPORT_FAQ_ITEMS, type SupportFaqBlock, type SupportFaqItem } from "./support-faq-data";

function FaqBodyContent({ blocks }: { blocks: SupportFaqBlock[] }) {
  return (
    <div className="y-spt-a-inner">
      {blocks.map((block, i) => {
        if (block.type === "p") {
          return (
            <Fragment key={i}>
              {i > 0 ? (
                <>
                  <br />
                  <br />
                </>
              ) : null}
              {block.text}
            </Fragment>
          );
        }
        return (
          <Fragment key={i}>
            <br />
            <br />
            <strong>{block.title}</strong>
            <br />
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}

function FaqItem({
  item,
  open,
  onToggle,
}: {
  item: SupportFaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;

  return (
    <div className={`y-spt-item${open ? " open" : ""}`}>
      <button
        type="button"
        className="y-spt-q"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span>{item.question}</span>
        <span className="y-spt-arrow" aria-hidden>
          ›
        </span>
      </button>
      <div id={panelId} className="y-spt-a" role="region" aria-hidden={!open}>
        <FaqBodyContent blocks={item.blocks} />
      </div>
    </div>
  );
}

/** 고객센터 모달 FAQ — yeonun_v20.html `.y-spt-*` 아코디언 */
export function FaqAccordion() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <>
      {SUPPORT_FAQ_ITEMS.map((item) => (
        <FaqItem key={item.id} item={item} open={openId === item.id} onToggle={() => toggle(item.id)} />
      ))}
      <div className="y-spt-email-foot">
        <p className="y-spt-email-foot-lead">해결되지 않으셨나요? 아래 이메일로 문의하기</p>
        <a className="y-spt-email-foot-addr" href={`mailto:${SUPPORT_FAQ_EMAIL}`}>
          {SUPPORT_FAQ_EMAIL}
        </a>
      </div>
    </>
  );
}
