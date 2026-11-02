const fs = require("fs");
const p = "C:/job ai/src/app/onboarding/page.tsx";
const s = fs.readFileSync(p, "utf8");
let count = 0;
for (let i = 0; i < s.length; i++) {
  if (s[i] === "`") {
    count++;
    console.log("tick", count, "at", i, JSON.stringify(s.slice(Math.max(0, i - 30), i + 30)));
  }
}
console.log("total ticks", count);
