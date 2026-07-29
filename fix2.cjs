const fs = require("fs");
let c = fs.readFileSync("src/components/AdminAnalysisReport.jsx","utf8");
// Fix all remaining className={px-1.5...} to className="px-1.5..."
const search = "className={px-1.5 py-0.5 rounded text-[10px] font-semibold }";
const replace = "className=\"px-1.5 py-0.5 rounded text-[10px] font-semibold\"";
while (c.includes(search)) {
  c = c.replace(search, replace);
}
fs.writeFileSync("src/components/AdminAnalysisReport.jsx", c, "utf8");
console.log("Fixed");
