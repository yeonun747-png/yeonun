import type { ShowcaseReviewView } from "@/lib/reviews-types";

type Props = {
  review: ShowcaseReviewView;
  variant?: "home" | "page";
};

export function ReviewCard({ review, variant = "home" }: Props) {
  if (variant === "page") {
    return (
      <article className="rv-card" data-stars={review.stars}>
        <header className="rv-card-head">
          <ReviewMeta review={review} variant="page" />
          <div className="rv-stars-col">
            <StarDisplay className="rv-stars" display={review.starsDisplay} />
            <time className="rv-date" dateTime={review.date.replace(/\./g, "-")}>
              {review.date}
            </time>
          </div>
        </header>
        <div className="rv-text">{review.body}</div>
        {review.tagsDisplay ? <div className="rv-tags">{review.tagsDisplay}</div> : null}
      </article>
    );
  }

  return (
    <article className="y-review-card">
      <header className="y-review-head">
        <ReviewMeta review={review} variant="home" />
        <StarDisplay className="y-review-stars" display={review.starsDisplay} />
      </header>
      <div className="y-review-text">{review.body}</div>
      {review.tagsDisplay ? <div className="y-review-tags">{review.tagsDisplay}</div> : null}
    </article>
  );
}

function ReviewMeta({ review, variant }: { review: ShowcaseReviewView; variant: "home" | "page" }) {
  const leftClass = variant === "page" ? "rv-card-left" : "y-review-meta-left";
  const avatarClass = variant === "page" ? "rv-avatar" : "y-review-avatar";
  const nameClass = variant === "page" ? "rv-name" : "y-review-name";
  const prodClass = variant === "page" ? "rv-prod" : "y-review-prod";

  return (
    <div className={leftClass}>
      <div className={`${avatarClass} ${review.characterKey}`} aria-hidden>
        {review.characterGlyph}
      </div>
      <div>
        <div className={nameClass}>{review.userMask}</div>
        <div className={prodClass}>{review.productLine}</div>
      </div>
    </div>
  );
}

function StarDisplay({ className, display }: { className: string; display: string }) {
  return (
    <span className={className} aria-label={`별점 ${display}`}>
      {display}
    </span>
  );
}
