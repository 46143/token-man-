const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const config = require('./config.json');

// MongoDB Schema (matching the current schema in authCache.js)
const authCacheSchema = new mongoose.Schema({
    discordId: { type: String, required: true },
    cacheName: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

authCacheSchema.index({ discordId: 1, cacheName: 1 }, { unique: true });

async function importTokens() {
    console.log('[Import] Starting token import to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(config.mongodbUri);
    console.log('[Import] Connected to MongoDB');
    
    const AuthCacheModel = mongoose.model('AuthCache', authCacheSchema);
    
    // Drop the entire collection to remove old indexes
    try {
        await AuthCacheModel.collection.drop();
        console.log('[Import] Dropped existing collection');
    } catch (error) {
        if (error.message.includes('ns not found')) {
            console.log('[Import] Collection does not exist, will create new one');
        } else {
            console.error('[Import] Error dropping collection:', error.message);
        }
    }
    
    // Read auth cache file
    const authCachePath = path.join(__dirname, 'data', 'authCache.json');
    
    if (!fs.existsSync(authCachePath)) {
        console.error('[Import] Auth cache file not found:', authCachePath);
        await mongoose.disconnect();
        return;
    }
    
    const data = JSON.parse(fs.readFileSync(authCachePath, 'utf8'));
    console.log(`[Import] Found ${data.length} entries in auth cache file`);
    
    // Import to MongoDB
    let imported = 0;
    
    for (const entry of data) {
        try {
            // discordId is already "1518766351798370375:2", cacheName is "sisu"
            // This matches what mongoCacheFactory expects
            // Don't modify discordId - it should be used as-is
            await AuthCacheModel.create({
                discordId: entry.discordId,
                cacheName: entry.cacheName,
                data: entry.data,
                updatedAt: entry.updatedAt || new Date()
            });
            
            console.log(`[Import] Imported: ${entry.discordId} with cacheName: ${entry.cacheName}`);
            imported++;
        } catch (error) {
            console.error(`[Import] Error importing ${entry.discordId}:${entry.cacheName}:`, error.message);
        }
    }
    
    console.log(`[Import] Import completed: ${imported} entries imported`);
    
    await mongoose.disconnect();
    console.log('[Import] Disconnected from MongoDB');
}

importTokens().catch(console.error);
