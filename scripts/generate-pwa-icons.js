import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create a simple SVG icon for eFootball Manager
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a5f"/>
      <stop offset="100%" style="stop-color:#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>
  <text x="256" y="300" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="220" fill="#22d3ee">eF</text>
  <text x="256" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-weight="600" font-size="60" fill="#38bdf8" letter-spacing="8">MANAGER</text>
</svg>`;

// Save SVG temporarily
const svgPath = path.join(publicDir, 'icon.svg');
fs.writeFileSync(svgPath, svgIcon);

// Generate PNG icons
const sizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generateIcons() {
  for (const { name, size } of sizes) {
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, name));
    console.log(`Created ${name} (${size}x${size})`);
  }

  // Also create a mask-icon.svg (simple version)
  const maskIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0f172a"/>
  <text x="256" y="300" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="220" fill="#22d3ee">eF</text>
  <text x="256" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-weight="600" font-size="60" fill="#38bdf8" letter-spacing="8">MANAGER</text>
</svg>`;
  fs.writeFileSync(path.join(publicDir, 'mask-icon.svg'), maskIcon);

  // Also copy the vite.svg as favicon.ico reference is fine
  // Remove the temporary SVG
  fs.unlinkSync(svgPath);

  console.log('All PWA icons generated successfully!');
}

generateIcons().catch(console.error);