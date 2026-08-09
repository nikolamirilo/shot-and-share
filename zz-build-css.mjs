import postcss from "postcss";
import tw from "@tailwindcss/postcss";
import { readFileSync, writeFileSync } from "node:fs";
const from = "/home/nikola/Desktop/say-cheese/src/app/globals.css";
const css = readFileSync(from, "utf8");
const out = await postcss([tw()]).process(css, { from });
writeFileSync(process.argv[2], out.css);
console.log("css bytes", out.css.length);
