import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public');

const SIZES = [256, 48, 32, 16];

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb"/>
      <stop offset="100%" style="stop-color:#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="40" fill="url(#bg)"/>
  <text x="128" y="100" text-anchor="middle" dominant-baseline="central"
        font-family="sans-serif" font-weight="bold" font-size="80" fill="white">保</text>
  <text x="128" y="185" text-anchor="middle" dominant-baseline="central"
        font-family="sans-serif" font-weight="bold" font-size="80" fill="white">険</text>
</svg>`;

function createIcoBuffer(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * count;

  let dataOffset = headerSize + dirSize;
  const entries = [];

  for (const { size, buffer } of pngBuffers) {
    entries.push({
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      dataSize: buffer.length,
      dataOffset,
      buffer,
    });
    dataOffset += buffer.length;
  }

  const totalSize = dataOffset;
  const ico = Buffer.alloc(totalSize);

  // ICO header
  ico.writeUInt16LE(0, 0);      // reserved
  ico.writeUInt16LE(1, 2);      // type: ICO
  ico.writeUInt16LE(count, 4);  // image count

  let offset = headerSize;
  for (const entry of entries) {
    ico.writeUInt8(entry.width, offset);
    ico.writeUInt8(entry.height, offset + 1);
    ico.writeUInt8(0, offset + 2);   // color palette
    ico.writeUInt8(0, offset + 3);   // reserved
    ico.writeUInt16LE(1, offset + 4);  // color planes
    ico.writeUInt16LE(32, offset + 6); // bits per pixel
    ico.writeUInt32LE(entry.dataSize, offset + 8);
    ico.writeUInt32LE(entry.dataOffset, offset + 12);
    offset += dirEntrySize;
  }

  for (const entry of entries) {
    entry.buffer.copy(ico, entry.dataOffset);
  }

  return ico;
}

async function main() {
  console.log('Generating app icon with "保険" text...');

  const svgBuffer = Buffer.from(svg);
  const pngBuffers = [];

  for (const size of SIZES) {
    const pngBuffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer: pngBuffer });
  }

  // Save individual PNG (largest)
  const pngPath = join(OUTPUT_DIR, 'app-icon.png');
  writeFileSync(pngPath, pngBuffers[0].buffer);
  console.log(`  Created: ${pngPath}`);

  // Create ICO
  const icoBuffer = createIcoBuffer(pngBuffers);
  const icoPath = join(OUTPUT_DIR, 'app-icon.ico');
  writeFileSync(icoPath, icoBuffer);
  console.log(`  Created: ${icoPath}`);

  console.log('Done!');
}

main().catch(console.error);
