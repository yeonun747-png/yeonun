import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "public", "product-thumbnails");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
let sql = "";
for (const f of files) {
  const slug = f.replace(/\.svg$/, "");
  const c = fs.readFileSync(path.join(dir, f), "utf8");
  if (c.includes("$yeonun$")) throw new Error(`delimiter collision: ${slug}`);
  sql += `update public.products set thumbnail_svg = $yeonun$${c}$yeonun$ where slug = '${slug}';\n`;
}
const out = path.join(root, "supabase", "_product_thumbnail_updates.sql");
fs.writeFileSync(out, sql, "utf8");
console.log("wrote", out, files.length, "updates");
