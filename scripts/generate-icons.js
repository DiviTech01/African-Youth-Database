/**
 * Generate app icons for African Youth Observatory
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// SVG icon: stylized Africa continent silhouette inside a gold ring
// with "AYO" text at the bottom
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F0C040"/>
      <stop offset="50%" style="stop-color:#D4A017"/>
      <stop offset="100%" style="stop-color:#B8860B"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#141414"/>
      <stop offset="100%" style="stop-color:#0A0A0A"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background circle -->
  <circle cx="512" cy="512" r="500" fill="url(#bgGrad)" stroke="url(#goldGrad)" stroke-width="12"/>

  <!-- Inner gold ring -->
  <circle cx="512" cy="512" r="440" fill="none" stroke="url(#goldGrad)" stroke-width="3" opacity="0.4"/>

  <!-- Simplified Africa continent silhouette -->
  <g transform="translate(512, 420) scale(2.8)" filter="url(#glow)">
    <path d="
      M -10,-120
      C -5,-125 10,-130 20,-125
      C 30,-120 40,-118 50,-115
      C 55,-112 60,-105 62,-100
      C 65,-90 68,-80 65,-70
      C 62,-60 60,-50 62,-40
      C 65,-30 70,-20 72,-10
      C 75,0 78,15 75,30
      C 72,45 68,55 60,65
      C 55,72 48,80 40,88
      C 35,93 28,98 20,100
      C 15,101 8,100 2,95
      C -5,88 -10,80 -12,70
      C -15,60 -18,50 -22,40
      C -28,28 -35,18 -42,8
      C -48,0 -52,-10 -55,-22
      C -58,-35 -55,-48 -50,-60
      C -45,-72 -38,-82 -32,-92
      C -28,-98 -22,-108 -18,-115
      C -15,-118 -12,-120 -10,-120
      Z
    " fill="url(#goldGrad)" opacity="0.9"/>
  </g>

  <!-- Decorative dots representing data points / African nations -->
  <g fill="#D4A017" opacity="0.6">
    <circle cx="420" cy="340" r="4"/>
    <circle cx="480" cy="310" r="3"/>
    <circle cx="540" cy="320" r="5"/>
    <circle cx="560" cy="370" r="3"/>
    <circle cx="500" cy="380" r="4"/>
    <circle cx="460" cy="400" r="3"/>
    <circle cx="520" cy="420" r="4"/>
    <circle cx="490" cy="450" r="3"/>
    <circle cx="530" cy="460" r="5"/>
    <circle cx="510" cy="500" r="3"/>
    <circle cx="475" cy="480" r="4"/>
    <circle cx="545" cy="510" r="3"/>
    <circle cx="500" cy="540" r="4"/>
    <circle cx="460" cy="520" r="3"/>
  </g>

  <!-- "AYO" text -->
  <text x="512" y="780" text-anchor="middle"
        font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
        font-weight="800" font-size="100" letter-spacing="18"
        fill="url(#goldGrad)">AYO</text>

  <!-- Subtitle -->
  <text x="512" y="840" text-anchor="middle"
        font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
        font-weight="400" font-size="36" letter-spacing="8"
        fill="#A89070" opacity="0.8">OBSERVATORY</text>
</svg>`;

async function generate() {
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const buildDir = path.join(__dirname, '..', 'build');
  const iconsDir = path.join(buildDir, 'icons');
  const electronIconsDir = path.join(__dirname, '..', 'electron', 'icons');

  // Ensure directories exist
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(electronIconsDir, { recursive: true });

  const svgBuffer = Buffer.from(SVG);

  // Generate PNGs at all sizes
  for (const size of sizes) {
    const png = await sharp(svgBuffer, { density: 300 })
      .resize(size, size)
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(iconsDir, `${size}x${size}.png`), png);
    console.log(`  Generated ${size}x${size}.png`);
  }

  // Copy key sizes for Electron
  const icon256 = await sharp(svgBuffer, { density: 300 }).resize(256, 256).png().toBuffer();
  const icon32 = await sharp(svgBuffer, { density: 300 }).resize(32, 32).png().toBuffer();
  const icon1024 = await sharp(svgBuffer, { density: 300 }).resize(1024, 1024).png().toBuffer();

  fs.writeFileSync(path.join(electronIconsDir, 'icon.png'), icon256);
  fs.writeFileSync(path.join(electronIconsDir, 'tray-icon.png'), icon32);
  fs.writeFileSync(path.join(buildDir, 'icon.png'), icon1024);

  // Save the SVG source too
  fs.writeFileSync(path.join(buildDir, 'icon.svg'), SVG);

  // Generate ICO (Windows) - multi-size ICO with 16, 32, 48, 256
  const icoSizes = [16, 32, 48, 256];
  const icoImages = [];
  for (const size of icoSizes) {
    const buf = await sharp(svgBuffer, { density: 300 })
      .resize(size, size)
      .raw()
      .toBuffer({ resolveWithObject: true });
    icoImages.push({ size, data: buf.data, info: buf.info });
  }

  const icoBuffer = buildIco(icoImages);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('  Generated icon.ico (multi-size)');

  // Generate ICNS placeholder hint
  console.log('\n  For macOS icon.icns, run:');
  console.log('    brew install libicns');
  console.log('    png2icns build/icon.icns build/icons/1024x1024.png build/icons/512x512.png build/icons/256x256.png build/icons/128x128.png build/icons/64x64.png build/icons/32x32.png build/icons/16x16.png');
  console.log('\n  Or use https://www.icoconverter.com/ to upload the 1024x1024.png');

  console.log('\nAll icons generated successfully!');
}

// Build a multi-image ICO file from raw RGBA buffers
function buildIco(images) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * images.length;

  // Calculate total size and offsets
  let offset = headerSize + dirSize;
  const entries = images.map(img => {
    const bmpHeaderSize = 40;
    const pixelDataSize = img.size * img.size * 4;
    const andMaskRowSize = Math.ceil(img.size / 8);
    const andMaskRowPadded = Math.ceil(andMaskRowSize / 4) * 4;
    const andMaskSize = andMaskRowPadded * img.size;
    const dataSize = bmpHeaderSize + pixelDataSize + andMaskSize;
    const entry = { ...img, offset, dataSize, bmpHeaderSize, pixelDataSize, andMaskSize, andMaskRowPadded };
    offset += dataSize;
    return entry;
  });

  const buf = Buffer.alloc(offset);
  let pos = 0;

  // ICO header
  buf.writeUInt16LE(0, pos); pos += 2;         // reserved
  buf.writeUInt16LE(1, pos); pos += 2;         // type: ICO
  buf.writeUInt16LE(images.length, pos); pos += 2; // count

  // Directory entries
  for (const e of entries) {
    buf.writeUInt8(e.size >= 256 ? 0 : e.size, pos); pos += 1;  // width
    buf.writeUInt8(e.size >= 256 ? 0 : e.size, pos); pos += 1;  // height
    buf.writeUInt8(0, pos); pos += 1;           // palette
    buf.writeUInt8(0, pos); pos += 1;           // reserved
    buf.writeUInt16LE(1, pos); pos += 2;        // planes
    buf.writeUInt16LE(32, pos); pos += 2;       // bpp
    buf.writeUInt32LE(e.dataSize, pos); pos += 4; // data size
    buf.writeUInt32LE(e.offset, pos); pos += 4;   // data offset
  }

  // Image data
  for (const e of entries) {
    const p = e.offset;
    // BMP info header
    buf.writeUInt32LE(40, p);
    buf.writeInt32LE(e.size, p + 4);
    buf.writeInt32LE(e.size * 2, p + 8);  // doubled height for ICO
    buf.writeUInt16LE(1, p + 12);
    buf.writeUInt16LE(32, p + 14);
    buf.writeUInt32LE(0, p + 16);         // no compression
    buf.writeUInt32LE(e.pixelDataSize + e.andMaskSize, p + 20);

    // Pixel data (BGRA, bottom-up)
    const pixStart = p + 40;
    for (let y = e.size - 1; y >= 0; y--) {
      for (let x = 0; x < e.size; x++) {
        const srcIdx = (y * e.size + x) * 4;  // RGBA from sharp
        const dstIdx = pixStart + ((e.size - 1 - y) * e.size + x) * 4;  // BGRA bottom-up
        buf[dstIdx] = e.data[srcIdx + 2];     // B
        buf[dstIdx + 1] = e.data[srcIdx + 1]; // G
        buf[dstIdx + 2] = e.data[srcIdx];     // R
        buf[dstIdx + 3] = e.data[srcIdx + 3]; // A
      }
    }
    // AND mask is already zeroed
  }

  return buf;
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
