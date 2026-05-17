export function HomeMoreSectionsSkeleton() {
  return (
    <div className="y-home-more-skel" aria-hidden>
      <div className="y-my-shelf-skel-line" style={{ width: "42%", marginBottom: 16 }} />
      <div className="y-my-shelf-skel-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="y-my-shelf-skel-card" style={{ minHeight: 120 }} />
        ))}
      </div>
    </div>
  );
}
