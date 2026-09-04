const fs = require('fs');
const path = require('path');

const authCachePath = path.join(__dirname, 'data', 'authCache.json');
const data = JSON.parse(fs.readFileSync(authCachePath, 'utf8'));

console.log('[Token Status] Checking token expiration dates...\n');

const now = new Date();
let validCount = 0;
let expiredCount = 0;

data.forEach(entry => {
    const key = entry.key;
    console.log(`\nAccount: ${key}`);
    
    // Check sisu token expiration
    if (entry.data.sisu && entry.data.sisu.token) {
        const obtainedOn = entry.data.sisu.token.obtainedOn;
        const expiresIn = entry.data.sisu.token.expires_in || 86400; // 24 hours default
        const expiresAt = new Date(obtainedOn + expiresIn * 1000);
        const isExpired = expiresAt < now;
        
        console.log(`  Sisu Token: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`);
        console.log(`    Expires: ${expiresAt.toISOString()}`);
        console.log(`    Remaining: ${Math.floor((expiresAt - now) / 1000 / 60)} minutes`);
        
        if (isExpired) expiredCount++;
        else validCount++;
    }
    
    // Check xbl tokens
    if (entry.data.xbl) {
        const userToken = entry.data.xbl.userToken;
        if (userToken) {
            const expiresAt = new Date(userToken.NotAfter);
            const isExpired = expiresAt < now;
            console.log(`  XBL User Token: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`);
            console.log(`    Expires: ${expiresAt.toISOString()}`);
        }
    }
    
    // Check mcs tokens
    if (entry.data.mcs && entry.data.mcs.mcs) {
        const validUntil = entry.data.mcs.mcs.validUntil;
        if (validUntil) {
            const expiresAt = new Date(validUntil);
            const isExpired = expiresAt < now;
            console.log(`  MC Token: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`);
            console.log(`    Expires: ${expiresAt.toISOString()}`);
        }
    }
});

console.log(`\n\n=== Summary ===`);
console.log(`Total Accounts: ${data.length}`);
console.log(`Valid Tokens: ${validCount}`);
console.log(`Expired Tokens: ${expiredCount}`);
console.log(`Current Time: ${now.toISOString()}`);
