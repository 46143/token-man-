const fs = require('fs');
const path = require('path');

const authCachePath = path.join(__dirname, 'data', 'authCache.json');

// Read current format
const data = JSON.parse(fs.readFileSync(authCachePath, 'utf8'));
console.log(`[Fix] Found ${data.length} entries`);

// Fix cacheNames that have duplicates like "sisu:sisu"
const fixedData = data.map(entry => {
    // If cacheName contains a colon, take the first part
    if (entry.cacheName.includes(':')) {
        const parts = entry.cacheName.split(':');
        entry.cacheName = parts[0];
        console.log(`[Fix] Fixed cacheName from ${entry.cacheName} to ${parts[0]}`);
    }
    return entry;
});

console.log(`[Fix] Fixed ${fixedData.length} entries`);

// Write back
fs.writeFileSync(authCachePath, JSON.stringify(fixedData, null, 2));
console.log(`[Fix] Saved to authCache.json`);
