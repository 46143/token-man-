const fs = require('fs');
const path = require('path');

const authCachePath = path.join(__dirname, 'data', 'authCache.json');
const dataDir = path.join(__dirname, 'data');

// Read current auth cache
const data = JSON.parse(fs.readFileSync(authCachePath, 'utf8'));
console.log(`[Setup] Found ${data.length} entries in auth cache`);

// Group by discordId
const grouped = {};
for (const entry of data) {
    const key = entry.discordId;
    if (!grouped[key]) {
        grouped[key] = {};
    }
    grouped[key][entry.cacheName] = entry.data;
}

// Create prismarine-auth cache structure
for (const [key, cacheData] of Object.entries(grouped)) {
    // Replace colons with underscores for Windows compatibility
    const safeKey = key.replace(/:/g, '_');
    const cacheDir = path.join(dataDir, safeKey);
    
    // Create directory
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`[Setup] Created cache directory: ${safeKey}`);
    }
    
    // Write cache.json
    const cacheFile = path.join(cacheDir, 'cache.json');
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    console.log(`[Setup] Wrote cache file for: ${safeKey}`);
}

console.log(`[Setup] Completed. Created ${Object.keys(grouped).length} cache directories`);
