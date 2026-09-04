const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const AUTH_CACHE_FILE = path.join(__dirname, 'data', 'authCache.json');
const memoryStore = new Map();

let isConnected = false;
let AuthCacheModel = null;

// MongoDB Schema
const authCacheSchema = new mongoose.Schema({
    discordId: { type: String, required: true },
    cacheName: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

authCacheSchema.index({ discordId: 1, cacheName: 1 }, { unique: true });

function ensureDataDir() {
    const dataDir = path.dirname(AUTH_CACHE_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function loadAuthCacheFromFile() {
    try {
        ensureDataDir();
        if (fs.existsSync(AUTH_CACHE_FILE)) {
            const data = fs.readFileSync(AUTH_CACHE_FILE, 'utf8');
            const cacheEntries = JSON.parse(data);
            
            memoryStore.clear();
            
            for (const entry of cacheEntries) {
                const key = `${entry.discordId}:${entry.cacheName}`;
                memoryStore.set(key, entry);
            }
            
            console.log(`Loaded ${cacheEntries.length} auth cache entries from file`);
        }
    } catch (error) {
        console.error('Failed to load auth cache from file:', error.message);
    }
}

function saveAuthCacheToFile() {
    try {
        ensureDataDir();
        const cacheEntries = Array.from(memoryStore.values());
        fs.writeFileSync(AUTH_CACHE_FILE, JSON.stringify(cacheEntries, null, 2));
    } catch (error) {
        console.error('Failed to save auth cache to file:', error.message);
    }
}

// Initialize MongoDB connection
async function initMongoDB(mongodbUri) {
    if (!mongodbUri) {
        console.log('[MongoDB] No MongoDB URI provided, using file-based storage');
        loadAuthCacheFromFile();
        return false;
    }

    try {
        await mongoose.connect(mongodbUri);
        isConnected = true;
        AuthCacheModel = mongoose.model('AuthCache', authCacheSchema);
        console.log('[MongoDB] Connected successfully');
        return true;
    } catch (error) {
        console.error('[MongoDB] Connection failed, falling back to file storage:', error.message);
        loadAuthCacheFromFile();
        return false;
    }
}

loadAuthCacheFromFile();

async function getAuthCacheEntry(discordId, cacheName) {
    if (isConnected && AuthCacheModel) {
        try {
            const entry = await AuthCacheModel.findOne({ discordId, cacheName });
            return entry;
        } catch (error) {
            console.error('[MongoDB] Error fetching entry:', error.message);
            const key = cacheName ? `${discordId}:${cacheName}` : discordId;
            return memoryStore.get(key) || null;
        }
    }
    const key = cacheName ? `${discordId}:${cacheName}` : discordId;
    return memoryStore.get(key) || null;
}

async function setAuthCacheEntry(discordId, cacheName, data) {
    const entry = {
        discordId,
        cacheName,
        data,
        updatedAt: new Date()
    };

    if (isConnected && AuthCacheModel) {
        try {
            await AuthCacheModel.findOneAndUpdate(
                { discordId, cacheName },
                entry,
                { upsert: true, new: true }
            );
            return entry;
        } catch (error) {
            console.error('[MongoDB] Error saving entry:', error.message);
            // Fallback to file storage
            const key = `${discordId}:${cacheName}`;
            memoryStore.set(key, entry);
            saveAuthCacheToFile();
            return entry;
        }
    }

    const key = `${discordId}:${cacheName}`;
    memoryStore.set(key, entry);
    saveAuthCacheToFile();
    return entry;
}

async function deleteAuthCacheEntry(key) {
    if (isConnected && AuthCacheModel) {
        try {
            const [discordId, cacheName] = key.split(':');
            const entry = await AuthCacheModel.findOneAndDelete({ discordId, cacheName });
            return entry;
        } catch (error) {
            console.error('[MongoDB] Error deleting entry:', error.message);
            const entry = memoryStore.get(key);
            memoryStore.delete(key);
            saveAuthCacheToFile();
            return entry || null;
        }
    }

    const entry = memoryStore.get(key);
    memoryStore.delete(key);
    saveAuthCacheToFile();
    return entry || null;
}

async function getAllAuthCacheEntries() {
    if (isConnected && AuthCacheModel) {
        try {
            const entries = await AuthCacheModel.find({});
            // Group by discordId and return unique accounts
            const grouped = {};
            for (const entry of entries) {
                const key = entry.discordId;
                if (!grouped[key]) {
                    grouped[key] = {
                        data: {},
                        updatedAt: entry.updatedAt
                    };
                }
                grouped[key].data[entry.cacheName] = entry.data;
                // Update to the most recent timestamp
                if (entry.updatedAt && (!grouped[key].updatedAt || new Date(entry.updatedAt) > new Date(grouped[key].updatedAt))) {
                    grouped[key].updatedAt = entry.updatedAt;
                }
            }
            return Object.entries(grouped).map(([key, { data, updatedAt }]) => ({ key, data, updatedAt }));
        } catch (error) {
            console.error('[MongoDB] Error fetching all entries:', error.message);
            return getUniqueAccountsFromFile();
        }
    }
    return getUniqueAccountsFromFile();
}

function getUniqueAccountsFromFile() {
    const grouped = {};
    for (const entry of memoryStore.values()) {
        const key = entry.discordId;
        if (!grouped[key]) {
            grouped[key] = {
                data: {},
                updatedAt: entry.updatedAt
            };
        }
        grouped[key].data[entry.cacheName] = entry.data;
        // Update to the most recent timestamp
        if (entry.updatedAt && (!grouped[key].updatedAt || new Date(entry.updatedAt) > new Date(grouped[key].updatedAt))) {
            grouped[key].updatedAt = entry.updatedAt;
        }
    }
    return Object.entries(grouped).map(([key, { data, updatedAt }]) => ({ key, data, updatedAt }));
}

module.exports = {
    getAuthCacheEntry,
    setAuthCacheEntry,
    deleteAuthCacheEntry,
    getAllAuthCacheEntries,
    initMongoDB
};
