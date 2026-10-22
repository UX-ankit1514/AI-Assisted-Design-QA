#!/usr/bin/env node
/*
 * Builds the end-to-end fixtures (PRD §15) from the sample pair:
 *   mismatch-1440x900.png   — valid PNG with different dimensions
 *   build-shifted.png       — the design moved 12 px down (global misalignment)
 *   not-an-image.gif        — unsupported format
 *   corrupt.png             — PNG signature followed by garbage
 *   long-design.png         — a long landing page: the sample design stacked 5× (1440 × 15,415, 22 MP)
 *   long-build.png          — the same, with the developed build in the 4th copy (changes far down the page)
 *   too-tall.png            — header declares 1440 × 40,000 px; rejected before decoding
 *
 *   npm run fixtures   (run `npm run samples` first)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "tests/fixtures");
mkdirSync(out, { recursive: true });

const design = PNG.sync.read(readFileSync(path.join(root, "public/samples/arnifi-home-design.png")));
const build = PNG.sync.read(readFileSync(path.join(root, "public/samples/arnifi-home-build.png")));

// Different dimensions: the top 900 px of the design.
const mismatch = new PNG({ width: design.width, height: 900 });
design.data.copy(mismatch.data, 0, 0, design.width * 900 * 4);
writeFileSync(path.join(out, "mismatch-1440x900.png"), PNG.sync.write(mismatch));

// Global misalignment: everything 12 px lower, white strip on top.
const shiftBy = 12;
const shifted = new PNG({ width: design.width, height: design.height });
shifted.data.fill(255);
design.data.copy(shifted.data, design.width * shiftBy * 4, 0, design.width * (design.height - shiftBy) * 4);
writeFileSync(path.join(out, "build-shifted.png"), PNG.sync.write(shifted));

// A real 1×1 GIF.
writeFileSync(path.join(out, "not-an-image.gif"), Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"));

// Looks like a PNG by its first bytes, but can't be decoded.
writeFileSync(path.join(out, "corrupt.png"), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("this is not image data".repeat(20))]));

// Long landing page: five copies of the page, the 4th one changed in the build.
const copies = 5;
const pageBytes = design.width * design.height * 4;
for (const [name, changedCopy] of [["long-design.png", -1], ["long-build.png", 3]]) {
  const long = new PNG({ width: design.width, height: design.height * copies });
  for (let c = 0; c < copies; c++) (c === changedCopy ? build : design).data.copy(long.data, c * pageBytes);
  writeFileSync(path.join(out, name), PNG.sync.write(long));
}

// A PNG whose header declares a page longer than browsers can handle; the app rejects it without decoding.
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(1440, 0);
ihdr.writeUInt32BE(40_000, 4);
ihdr.set([8, 6, 0, 0, 0], 8);
writeFileSync(
  path.join(out, "too-tall.png"),
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IEND", Buffer.alloc(0))]),
);

console.log("Wrote e2e fixtures to tests/fixtures/");
