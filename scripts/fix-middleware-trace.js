// Fix for Vercel: Turbopack doesn't generate middleware.js.nft.json
// This script creates it if missing after build
const fs = require('fs');
const path = require('path');

const nftPath = path.join(__dirname, '..', '.next', 'server', 'middleware.js.nft.json');

if (!fs.existsSync(nftPath)) {
  const dir = path.dirname(nftPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(nftPath, JSON.stringify({ version: 1, files: [] }));
  console.log('✅ Created middleware.js.nft.json');
} else {
  console.log('✅ middleware.js.nft.json already exists');
}
