const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const config = require('./config.json');

// MongoDB Schema
const authCacheSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

authCacheSchema.index({ key: 1 }, { unique: true });

async function importTokens() {
    console.log('[Import] Starting token import...');
    
    // Connect to MongoDB
    await mongoose.connect(config.mongodbUri);
    console.log('[Import] Connected to MongoDB');
    
    const AuthCacheModel = mongoose.model('AuthCache', authCacheSchema);
    
    // Read old auth cache file
    const oldAuthCachePath = path.join(__dirname, '..', 'data', 'authCache.json');
    
    if (!fs.existsSync(oldAuthCachePath)) {
        console.error('[Import] Old auth cache file not found:', oldAuthCachePath);
        await mongoose.disconnect();
        return;
    }
    
    const oldData = JSON.parse(fs.readFileSync(oldAuthCachePath, 'utf8'));
    console.log(`[Import] Found ${oldData.length} entries in old auth cache`);
    
    // Group by discordId (key)
    const groupedData = {};
    
    for (const entry of oldData) {
        const key = entry.discordId;
        if (!groupedData[key]) {
            groupedData[key] = {};
        }
        groupedData[key][entry.cacheName] = entry.data;
    }
    
    console.log(`[Import] Grouped into ${Object.keys(groupedData).length} unique accounts`);
    
    // Import to MongoDB
    let imported = 0;
    let skipped = 0;
    
    for (const [key, data] of Object.entries(groupedData)) {
        try {
            // Check if already exists
            const existing = await AuthCacheModel.findOne({ key });
            
            if (existing) {
                console.log(`[Import] Skipping existing key: ${key}`);
                skipped++;
                continue;
            }
            
            // Create new entry
            await AuthCacheModel.create({
                key,
                data,
                updatedAt: new Date()
            });
            
            console.log(`[Import] Imported key: ${key}`);
            imported++;
        } catch (error) {
            console.error(`[Import] Error importing key ${key}:`, error.message);
        }
    }
    
    console.log(`[Import] Import completed: ${imported} imported, ${skipped} skipped`);
    
    await mongoose.disconnect();
    console.log('[Import] Disconnected from MongoDB');
}

importTokens().catch(console.error);
