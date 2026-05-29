/**
 * PWA 아이콘 — public/logo/yeonun_app_icon_c_1024.svg 기준 PNG 생성
 * 실행: node scripts/generate-pwa-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");
const svgPath = path.join(__dirname, "..", "public", "logo", "yeonun_app_icon_c_1024.svg");

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("sharp 패키지가 필요합니다: npm install -D sharp");
    process.exit(1);
  }

  if (!fs.existsSync(svgPath)) {
    console.error("SVG not found:", svgPath);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const svgBuffer = fs.readFileSync(svgPath);

  const sizes = [
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
  ];

  for (const { name, size } of sizes) {
    await sharp(svgBuffer, { density: 300 })
      .resize(size, size, { fit: "contain", background: { r: 253, g: 240, b: 243, alpha: 1 } })
      .png()
      .toFile(path.join(outDir, name));
    console.log("wrote", name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
