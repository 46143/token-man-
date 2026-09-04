const fs = require('fs');
const path = require('path');

const authCachePath = path.join(__dirname, 'data', 'authCache.json');

// Read current format
const data = JSON.parse(fs.readFileSync(authCachePath, 'utf8'));
console.log(`[Fix] Found ${data.length} entries`);

// Fix discordIds that have extra parts like "1518766351798370375:3:sisu"
const fixedData = data.map(entry => {
    // If discordId has more than one colon, take only the first two parts
    const parts = entry.discordId.split(':');
    if (parts.length > 2) {
        entry.discordId = `${parts[0]}:${parts[1]}`;
        console.log(`[Fix] Fixed discordId from ${entry.discordId} to ${parts[0]}:${parts[1]}`);
    }
    return entry;
});

console.log(`[Fix] Fixed ${fixedData.length} entries`);

// Write back
fs.writeFileSync(authCachePath, JSON.stringify(fixedData, null, 2));
console.log(`[Fix] Saved to authCache.json`);
