const fs = require('fs');
const path = require('path');

const authCachePath = path.join(__dirname, 'data', 'authCache.json');

// Read current format
const data = JSON.parse(fs.readFileSync(authCachePath, 'utf8'));
console.log(`[Convert] Found ${data.length} entries in current format`);

// Check if already in correct format (discordId contains slot, cacheName is actual cache name)
const isCorrectFormat = data.some(entry => 
    entry.discordId.includes(':') && 
    ['sisu', 'xbl', 'pfb', 'mcs'].includes(entry.cacheName)
);

if (isCorrectFormat) {
    console.log('[Convert] Data is already in correct format, no conversion needed');
    process.exit(0);
}

// Group by discordId and slot number
const grouped = {};

for (const entry of data) {
    const discordId = entry.discordId;
    const slot = entry.cacheName; // This is the slot number like "2"
    
    if (!grouped[discordId]) {
        grouped[discordId] = {};
    }
    
    if (!grouped[discordId][slot]) {
        grouped[discordId][slot] = {};
    }
    
    // The cacheName should be determined by the data structure
    // If data has "token", it's sisu. If it has "userToken", it's xbl, etc.
    let cacheName = entry.cacheName;
    
    if (entry.data.token) {
        cacheName = 'sisu';
    } else if (entry.data.userToken) {
        cacheName = 'xbl';
    } else if (entry.data.pfb) {
        cacheName = 'pfb';
    } else if (entry.data.mcs) {
        cacheName = 'mcs';
    }
    
    grouped[discordId][slot][cacheName] = entry.data;
}

// Convert to correct format
const correctedFormat = [];

for (const [discordId, slots] of Object.entries(grouped)) {
    for (const [slot, cacheData] of Object.entries(slots)) {
        const fullKey = `${discordId}:${slot}`;
        
        for (const [cacheName, data] of Object.entries(cacheData)) {
            correctedFormat.push({
                discordId: fullKey,
                cacheName: cacheName,
                data: data,
                updatedAt: new Date()
            });
        }
    }
}

console.log(`[Convert] Converted to ${correctedFormat.length} entries in correct format`);

// Write back
fs.writeFileSync(authCachePath, JSON.stringify(correctedFormat, null, 2));
console.log(`[Convert] Saved to authCache.json`);
