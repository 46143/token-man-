const fs = require('fs');
const path = require('path');

const authCachePath = path.join(__dirname, 'data', 'authCache.json');

// Read old format
const oldData = JSON.parse(fs.readFileSync(authCachePath, 'utf8'));
console.log(`[Convert] Found ${oldData.length} entries in old format`);

// Group by discordId (key)
const groupedData = {};

for (const entry of oldData) {
    const key = entry.discordId;
    if (!groupedData[key]) {
        groupedData[key] = {};
    }
    groupedData[key][entry.cacheName] = entry.data;
}

console.log(`[Convert] Grouped into ${Object.keys(groupedData).length} unique accounts`);

// Convert to new format (array of objects with key and data)
const newData = Object.entries(groupedData).map(([key, data]) => ({
    key,
    data,
    updatedAt: new Date().toISOString()
}));

// Write new format
fs.writeFileSync(authCachePath, JSON.stringify(newData, null, 2));
console.log(`[Convert] Converted to new format and saved`);
console.log(`[Convert] Keys: ${newData.map(e => e.key).join(', ')}`);
