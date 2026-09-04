const { Authflow, Titles } = require('prismarine-auth');
const path = require('path');

async function testTokenRefresh() {
    const key = '1518766351798370375:1';
    const safeKey = key.replace(/:/g, '_');
    const cacheDir = path.join(__dirname, 'data', safeKey);
    
    console.log(`[Test] Testing token refresh for key: ${key}`);
    console.log(`[Test] Cache directory: ${cacheDir}`);
    
    try {
        const authflow = new Authflow(key, cacheDir, {
            flow: 'sisu',
            authTitle: Titles.MinecraftIOS,
            deviceType: 'iOS'
        });

        console.log('[Test] Getting Minecraft Bedrock token...');
        const mcToken = await authflow.getMinecraftBedrockServicesToken({ version: '1.26.45' });
        
        console.log('[Test] SUCCESS! Token obtained:');
        console.log(`  MC Token: ${mcToken.mcToken.substring(0, 50)}...`);
        console.log(`  Expires: ${mcToken.expiresOn}`);
        
    } catch (error) {
        console.error('[Test] FAILED:', error.message);
        console.error('[Test] Error details:', error);
    }
}

testTokenRefresh();
