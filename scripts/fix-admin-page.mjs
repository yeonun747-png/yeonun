import fs from "fs";

const p = "src/app/admin/page.tsx";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf('content={\n        <section className="y-admin-section y-admin-section--placeholder">');
const end = s.indexOf('content={\n        <section className="y-admin-section">', start + 1);
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}
s = s.slice(0, start) + s.slice(end);
fs.writeFileSync(p, s, "utf8");
console.log("fixed page.tsx");
