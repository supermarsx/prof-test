/**
 * gen-icons.js
 *
 * Generates minimal valid icon placeholder files for Tauri builds.
 * Output directory: src-tauri/icons/
 *
 * Files produced:
 *   - 32x32.png        (valid 32x32 RGBA PNG, solid dark-blue)
 *   - 128x128.png      (valid 128x128 RGBA PNG, solid dark-blue)
 *   - 128x128@2x.png   (valid 256x256 RGBA PNG, solid dark-blue)
 *   - icon.ico          (valid ICO containing one 32x32 image)
 *   - icon.icns         (valid ICNS containing one 32x32 image)
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "src-tauri", "icons");

// ---------------------------------------------------------------------------
// PNG helpers
// ---------------------------------------------------------------------------

function crc32(buf) {
  // Standard CRC-32 used by PNG
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  // type: 4-char string, data: Buffer
  const typeB = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

/**
 * Build a minimal valid RGBA PNG of the given size filled with a solid colour.
 * colour = [R, G, B, A]  (0-255 each)
 */
function buildPng(width, height, colour) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = pngChunk("IHDR", ihdr);

  // Raw image data: each row = filter-byte (0) + width * 4 bytes RGBA
  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowLen;
    raw[offset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 4;
      raw[px] = colour[0];
      raw[px + 1] = colour[1];
      raw[px + 2] = colour[2];
      raw[px + 3] = colour[3];
    }
  }

  const compressed = zlib.deflateSync(raw);
  const idatChunk = pngChunk("IDAT", compressed);
  const iendChunk = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ---------------------------------------------------------------------------
// ICO helper  (one 32x32 RGBA entry, BMP-encoded)
// ---------------------------------------------------------------------------

function buildIco(pngBuf32) {
  // We embed the 32x32 PNG directly (modern ICO supports PNG payload).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type: ICO
  header.writeUInt16LE(1, 4);      // 1 image

  const entry = Buffer.alloc(16);
  entry[0] = 32;                   // width  (0 means 256)
  entry[1] = 32;                   // height
  entry[2] = 0;                    // colour palette
  entry[3] = 0;                    // reserved
  entry.writeUInt16LE(1, 4);       // colour planes
  entry.writeUInt16LE(32, 6);      // bits per pixel
  entry.writeUInt32LE(pngBuf32.length, 8);  // image data size
  entry.writeUInt32LE(6 + 16, 12);          // offset to image data

  return Buffer.concat([header, entry, pngBuf32]);
}

// ---------------------------------------------------------------------------
// ICNS helper  (one 'ic07' entry = 128x128 PNG)
// ---------------------------------------------------------------------------

function buildIcns(pngBuf128) {
  // ICNS file: 4-byte magic + 4-byte total file size + entries
  // Entry: 4-byte type + 4-byte entry size (incl. header) + data
  const type = Buffer.from("ic07", "ascii"); // 128x128 PNG
  const entrySize = Buffer.alloc(4);
  entrySize.writeUInt32BE(8 + pngBuf128.length, 0);

  const magic = Buffer.from("icns", "ascii");
  const totalSize = Buffer.alloc(4);
  totalSize.writeUInt32BE(8 + 8 + pngBuf128.length, 0);

  return Buffer.concat([magic, totalSize, type, entrySize, pngBuf128]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Solid dark-blue colour [R, G, B, A]
  const colour = [30, 60, 120, 255];

  const png32 = buildPng(32, 32, colour);
  const png128 = buildPng(128, 128, colour);
  const png256 = buildPng(256, 256, colour);

  fs.writeFileSync(path.join(OUT_DIR, "32x32.png"), png32);
  fs.writeFileSync(path.join(OUT_DIR, "128x128.png"), png128);
  fs.writeFileSync(path.join(OUT_DIR, "128x128@2x.png"), png256);
  fs.writeFileSync(path.join(OUT_DIR, "icon.ico"), buildIco(png32));
  fs.writeFileSync(path.join(OUT_DIR, "icon.icns"), buildIcns(png128));

  // Print results
  const files = fs.readdirSync(OUT_DIR);
  console.log(`Generated ${files.length} files in ${OUT_DIR}:`);
  for (const f of files) {
    const stat = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f}  (${stat.size} bytes)`);
  }
}

main();
