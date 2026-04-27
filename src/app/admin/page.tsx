import { supabaseServer } from "@/lib/supabase/server";

export default async function AdminHomePage() {
  const supabase = supabaseServer();

  const [{ data: products }, { data: characters }, { data: categories }] =
    await Promise.all([
      supabase
        .from("products")
        .select("slug,title,price_krw,category_slug,character_key,badge")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("characters").select("key,name").order("key"),
      supabase.from("categories").select("slug,label").order("sort_order"),
    ]);

  return (
    <div className="yeonunPage">
      <main style={{ padding: "22px 20px" }}>
        <h1 style={{ fontFamily: '"Noto Serif KR", serif', fontSize: 20, fontWeight: 600 }}>
          어드민
        </h1>
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--y-mute)", lineHeight: 1.6 }}>
          상품/카테고리/캐릭터 CRUD는 다음 단계에서 화면을 확장합니다. 우선 상품 추가/삭제만
          구현해 둡니다.
        </p>

        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--y-ink)" }}>상품 추가</h2>
          <form action="/admin/products" method="post" style={{ marginTop: 10 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                name="slug"
                placeholder="slug (예: reunion-maybe)"
                style={inputStyle}
              />
              <input name="title" placeholder="title" style={inputStyle} />
              <input name="quote" placeholder="quote" style={inputStyle} />
              <input
                name="price_krw"
                placeholder="price_krw (예: 14900)"
                inputMode="numeric"
                style={inputStyle}
              />

              <select name="category_slug" style={inputStyle}>
                {(categories ?? []).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label} ({c.slug})
                  </option>
                ))}
              </select>

              <select name="character_key" style={inputStyle}>
                {(characters ?? []).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name} ({c.key})
                  </option>
                ))}
              </select>

              <input name="badge" placeholder="badge (HOT/NEW/2026/SIGNATURE 등)" style={inputStyle} />
            </div>

            <button type="submit" style={primaryBtn}>
              저장
            </button>
          </form>
        </section>

        <section style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--y-ink)" }}>상품 목록</h2>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {(products ?? []).map((p) => (
              <div
                key={p.slug}
                style={{
                  background: "white",
                  border: "0.5px solid var(--y-line)",
                  borderRadius: 12,
                  padding: "12px 12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--y-ink)" }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--y-mute)" }}>
                      {p.slug} · {p.category_slug} · {p.character_key} · {p.badge ?? "-"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--y-ink)" }}>
                      {Number(p.price_krw).toLocaleString("ko-KR")}원
                    </div>
                    <form action="/admin/products/delete" method="post">
                      <input type="hidden" name="slug" value={p.slug} />
                      <button type="submit" style={dangerBtn}>
                        삭제
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "0.5px solid var(--y-line)",
  background: "white",
  fontSize: 12.5,
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: "14px",
  borderRadius: 999,
  border: "none",
  background: "var(--y-rose)",
  color: "white",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  marginTop: 8,
  padding: "8px 10px",
  borderRadius: 999,
  border: "0.5px solid var(--y-line)",
  background: "white",
  color: "var(--y-rose-deep)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

