const { Authflow, Titles } = require('prismarine-auth');
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Load config from environment variables (for Render) or config.json (for local)
let config;
if (process.env.MONGO_URI || process.env.TOKEN) {
    config = {
        token: process.env.TOKEN,
        applicationId: process.env.APPLICATION_ID || '',
        channels: {
            refresh: process.env.REFRESH_CHANNEL_ID || '',
            add: process.env.ADD_CHANNEL_ID || '',
            expired: process.env.EXPIRED_CHANNEL_ID || ''
        },
        mongoURI: process.env.MONGO_URI
    };
} else {
    config = require('./config.json');
}

const { getAuthCacheEntry, setAuthCacheEntry, getAllAuthCacheEntries, initMongoDB } = require('./authCache');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Auth cache factory that matches prismarine-auth interface (from Versicherungs-Meister)
function mongoCacheFactory({ username, cacheName }) {
    return {
        async getCached() {
            const entry = await getAuthCacheEntry(username, cacheName);
            return entry?.data ?? {};
        },
        async setCached(value) {
            await setAuthCacheEntry(username, cacheName, value);
        },
        async setCachedPartial(value) {
            const entry = await getAuthCacheEntry(username, cacheName);
            await setAuthCacheEntry(username, cacheName, { ...(entry?.data ?? {}), ...value });
        },
        async reset() {
            await setAuthCacheEntry(username, cacheName, {});
        }
    };
}

// Token refresh function
async function refreshToken(key) {
    try {
        console.log(`[Token Refresh] Refreshing token for key: ${key}`);
        
        const authflow = new Authflow(key, mongoCacheFactory, {
            flow: 'sisu',
            authTitle: Titles.MinecraftIOS,
            deviceType: 'iOS'
        });

        const mcToken = await authflow.getMinecraftBedrockServicesToken({ version: '1.26.45' });
        
        // Try to get gamertag from cached Xbox data
        let gamertag = 'Unknown';
        let xuid = null;
        try {
            const xblCache = await getAuthCacheEntry(key, 'xbl');
            if (xblCache && xblCache.data && xblCache.data.userToken && xblCache.data.userToken.DisplayClaims) {
                const xui = xblCache.data.userToken.DisplayClaims.xui;
                if (xui && xui[0]) {
                    const uhs = xui[0].uhs;
                    if (uhs) {
                        xuid = uhs;
                        gamertag = `XUID: ${uhs}`;
                    }
                }
            }
        } catch (error) {
            console.log('[Token Refresh] Could not get gamertag from cache:', error.message);
        }
        
        // Try to fetch actual gamertag from Xbox API
        if (xuid) {
            try {
                const xboxToken = await authflow.getXboxToken('http://xboxlive.com');
                const authHeader = `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`;
                
                const response = await fetch('https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag', {
                    headers: {
                        'x-xbl-contract-version': '2',
                        Authorization: authHeader
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const gamertagSetting = data?.profileUsers?.[0]?.settings?.find((setting) => setting.id === 'Gamertag');
                    if (gamertagSetting?.value) {
                        gamertag = gamertagSetting.value;
                    }
                }
            } catch (error) {
                console.log('[Token Refresh] Could not fetch gamertag from API:', error.message);
            }
        }
        
        // Calculate token expiration (24 hours from now)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const timeUntilExpiry = expiresAt.toLocaleString();
        
        // Calculate time remaining dynamically
        const now = new Date();
        const diffMs = expiresAt - now;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const expiresIn = `${diffHours}h ${diffMinutes}m`;
        
        console.log(`[Token Refresh] Successfully refreshed token for key: ${key} (Gamertag: ${gamertag}, Expires: ${timeUntilExpiry})`);
        
        return {
            success: true,
            key,
            gamertag,
            expiresAt: timeUntilExpiry,
            expiresIn: expiresIn,
            mcToken: mcToken.mcToken
        };
    } catch (error) {
        console.error(`[Token Refresh] Failed to refresh token for key ${key}:`, error.message);
        return {
            success: false,
            key,
            gamertag: 'Unknown',
            expiresAt: 'N/A',
            error: error.message
        };
    }
}

// Refresh all tokens
async function refreshAllTokens() {
    console.log('[Token Refresh] Starting automatic token refresh for all entries...');
    
    const entries = await getAllAuthCacheEntries();
    const results = [];
    
    // Refresh tokens one by one with delay to avoid rate limits
    for (const entry of entries) {
        const result = await refreshToken(entry.key);
        results.push(result);
        
        // Send notification after each token refresh
        if (config.channels?.refresh) {
            try {
                const channel = await client.channels.fetch(config.channels.refresh);
                if (channel) {
                    // Extract Discord ID from key (format: "1518766351798370375:2")
                    const discordId = entry.key.split(':')[0];
                    const discordMention = `<@${discordId}>`;
                    const status = result.success ? '✅' : '❌';
                    const message = `**Token Refresh**\n${status} ${discordMention} (${result.gamertag}): ${result.success ? 'Success' : result.error}\n⏰ Expires in: ${result.expiresIn}\n📅 Expires at: ${result.expiresAt}`;
                    await channel.send(message);
                }
            } catch (error) {
                console.error('[Token Refresh] Failed to send notification:', error.message);
            }
        }
        
        // Wait 5 minutes between each token refresh to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[Token Refresh] Completed: ${successful} successful, ${failed} failed`);
    
    // Send final summary notification
    if (config.channels?.refresh) {
        try {
            const channel = await client.channels.fetch(config.channels.refresh);
            if (channel) {
                let message = `**Token Refresh Summary**\n`;
                message += `✅ Successful: ${successful}\n`;
                message += `❌ Failed: ${failed}\n\n`;
                
                if (failed > 0) {
                    message += `**Failed Keys:**\n`;
                    results.filter(r => !r.success).forEach(r => {
                        message += `- ${r.key}: ${r.error}\n`;
                    });
                }
                
                await channel.send(message);
            }
        } catch (error) {
            console.error('[Notification] Failed to send refresh notification:', error.message);
        }
    }
    
    // Send notification to expired channel for failed tokens
    if (config.channels?.expired && failed > 0) {
        try {
            const channel = await client.channels.fetch(config.channels.expired);
            if (channel) {
                let message = `**⚠️ Token Expired/Failed**\n`;
                message += `The following tokens failed to refresh:\n\n`;
                results.filter(r => !r.success).forEach(r => {
                    message += `- **Account:** ${r.key}\n`;
                    message += `  **Error:** ${r.error}\n\n`;
                });
                message += `Please re-authenticate these accounts.`;
                
                await channel.send(message);
            }
        } catch (error) {
            console.error('[Notification] Failed to send expired notification:', error.message);
        }
    }
    
    return results;
}

// Slash command: /token
const tokenCommand = new SlashCommandBuilder()
    .setName('token')
    .setDescription('Manage Minecraft Bedrock tokens')
    .addSubcommand(subcommand =>
        subcommand
            .setName('refresh')
            .setDescription('Refresh tokens')
            .addStringOption(option =>
                option
                    .setName('key')
                    .setDescription('Specific key to refresh (optional - refreshes all if not provided)')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Add a new token')
            .addStringOption(option =>
                option
                    .setName('access_token')
                    .setDescription('The access token')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('refresh_token')
                    .setDescription('The refresh token')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('name')
                    .setDescription('Name for this token (e.g., account name)')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List all token keys')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('import')
            .setDescription('Import a full prismarine-auth cache')
            .addStringOption(option =>
                option
                    .setName('key')
                    .setDescription('The key for the token (e.g., user:slot)')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('cache')
                    .setDescription('The prismarine-auth cache JSON')
                    .setRequired(true)
            )
    )

// Slash command: /accounts
const accountsCommand = new SlashCommandBuilder()
    .setName('accounts')
    .setDescription('List all linked Minecraft accounts');

client.once('ready', async () => {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    
    // Initialize MongoDB
    await initMongoDB(config.mongodbUri);
    
    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    try {
        console.log('[Bot] Started refreshing application (/) commands.');
        
        await rest.put(
            Routes.applicationCommands(config.applicationId),
            { body: [tokenCommand, accountsCommand] }
        );
        
        console.log('[Bot] Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('[Bot] Error reloading application (/) commands:', error);
    }
    
    // Start automatic token refresh (every 6 hours)
    setInterval(async () => {
        await refreshAllTokens();
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    // Initial refresh
    setTimeout(async () => {
        await refreshAllTokens();
    }, 5000); // 5 seconds after startup
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'token') {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'refresh') {
            const specificKey = interaction.options.getString('key');
            
            await interaction.reply({ 
                content: `🔄 Starting token refresh...`,
                ephemeral: true 
            });
            
            if (specificKey) {
                // Refresh specific token
                const result = await refreshToken(specificKey);
                
                let message = `**Token Refresh Result:**\n`;
                if (result.success) {
                    message += `✅ Successfully refreshed: ${specificKey}\n`;
                    message += `Gamertag: ${result.gamertag}\n`;
                    message += `Expires in: ${result.expiresIn}\n`;
                    message += `Expires at: ${result.expiresAt}`;
                } else {
                    message += `❌ Failed to refresh: ${specificKey}\n`;
                    message += `Error: ${result.error}`;
                }
                
                await interaction.editReply({ content: message });
            } else {
                // Refresh all tokens
                const results = await refreshAllTokens();
                
                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success).length;
                
                let message = `**Token Refresh Results:**\n`;
                message += `✅ Successful: ${successful}\n`;
                message += `❌ Failed: ${failed}\n\n`;
                
                if (failed > 0) {
                    message += `**Failed Keys:**\n`;
                    results.filter(r => !r.success).forEach(r => {
                        message += `- ${r.key}: ${r.error}\n`;
                    });
                }
                
                await interaction.editReply({ content: message });
            }
        }
        
        if (subcommand === 'add') {
            const accessToken = interaction.options.getString('access_token');
            const refreshToken = interaction.options.getString('refresh_token');
            const name = interaction.options.getString('name') || 'Unknown';
            
            // Generate a unique key for this token
            const key = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store the tokens in the cache with Discord info
            const tokenData = {
                accessToken,
                refreshToken,
                name,
                discordId: interaction.user.id,
                discordTag: interaction.user.tag,
                addedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
            
            await setAuthCacheEntry(key, 'sisu', tokenData);
            
            await interaction.reply({ 
                content: `✅ Added token: ${name}\nKey: ${key}\n\nNote: This bot currently uses prismarine-auth which requires a complex token cache. Simple access/refresh tokens may not work for refresh. Consider using the full prismarine-auth cache format.`,
                ephemeral: true 
            });
            
            // Send notification to add channel
            if (config.channels?.add) {
                try {
                    const channel = await client.channels.fetch(config.channels.add);
                    if (channel) {
                        await channel.send(`**New Token Added**\nName: ${name}\nKey: ${key}\nAdded by: ${interaction.user.tag}`);
                    }
                } catch (error) {
                    console.error('[Notification] Failed to send add notification:', error.message);
                }
            }
        }
        
        if (subcommand === 'list') {
            const entries = await getAllAuthCacheEntries();
            
            if (entries.length === 0) {
                await interaction.reply({ 
                    content: 'No token keys found. Use `/token add` to add a new key.',
                    ephemeral: true 
                });
                return;
            }
            
            let message = `📋 **Token Keys (${entries.length})**\n\n`;
            
            for (const entry of entries) {
                const lastUpdated = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'Unknown';
                
                // Calculate expiration (24 hours from last update)
                let expiresAt = 'Unknown';
                let expiresIn = 'Unknown';
                if (entry.updatedAt) {
                    const expiryDate = new Date(new Date(entry.updatedAt).getTime() + 24 * 60 * 60 * 1000);
                    expiresAt = expiryDate.toLocaleString();
                    const now = new Date();
                    const diffMs = expiryDate - now;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    expiresIn = `${diffHours}h ${diffMinutes}m`;
                }
                
                // Get Discord info and name from token data
                let discordMention = 'Unknown';
                let displayName = 'Unknown';
                try {
                    const sisuCache = await getAuthCacheEntry(entry.key, 'sisu');
                    if (sisuCache && sisuCache.data) {
                        if (sisuCache.data.discordId) {
                            discordMention = `<@${sisuCache.data.discordId}>`;
                        }
                        if (sisuCache.data.name) {
                            displayName = sisuCache.data.name;
                        }
                    }
                } catch (error) {
                    // Keep defaults
                }
                
                // Get gamertag from cache
                let gamertag = 'Unknown';
                try {
                    const xblCache = await getAuthCacheEntry(entry.key, 'xbl');
                    if (xblCache && xblCache.data && xblCache.data.userToken && xblCache.data.userToken.DisplayClaims) {
                        const xui = xblCache.data.userToken.DisplayClaims.xui;
                        if (xui && xui[0]) {
                            const uhs = xui[0].uhs;
                            if (uhs) {
                                gamertag = `XUID: ${uhs}`;
                            }
                        }
                    }
                } catch (error) {
                    // Keep gamertag as Unknown
                }
                
                message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                message += `👤 **${discordMention}** (${displayName})\n`;
                message += `🔑 Key: \`${entry.key}\`\n`;
                message += `🎮 Gamertag: ${gamertag}\n`;
                message += `🕒 Last updated: ${lastUpdated}\n`;
                message += `⏰ Expires in: ${expiresIn}\n`;
                message += `📅 Expires at: ${expiresAt}\n\n`;
            }
            
            await interaction.reply({ 
                content: message,
                ephemeral: true 
            });
        }
        
        if (subcommand === 'status') {
            const entries = await getAllAuthCacheEntries();
            
            let message = `**Token Refresh Status:**\n`;
            message += `Total keys: ${entries.length}\n`;
            message += `Auto-refresh: Every 6 hours\n`;
            message += `Last refresh: ${new Date().toLocaleString()}\n`;
            
            await interaction.reply({ 
                content: message,
                ephemeral: true 
            });
        }
        
        if (subcommand === 'import') {
            const key = interaction.options.getString('key');
            const cacheJson = interaction.options.getString('cache');
            
            try {
                const cacheData = JSON.parse(cacheJson);
                
                // Store each cache entry
                for (const entry of cacheData) {
                    const cacheName = entry.cacheName;
                    const data = entry.data;
                    
                    await setAuthCacheEntry(key, cacheName, data);
                }
                
                await interaction.reply({ 
                    content: `✅ Successfully imported prismarine-auth cache for key: ${key}\n\nCache entries: ${cacheData.length}`,
                    ephemeral: true 
                });
                
                // Send notification to add channel
                if (config.channels?.add) {
                    try {
                        const channel = await client.channels.fetch(config.channels.add);
                        if (channel) {
                            await channel.send(`**Cache Imported**\nKey: ${key}\nEntries: ${cacheData.length}\nAdded by: ${interaction.user.tag}`);
                        }
                    } catch (error) {
                        console.error('[Notification] Failed to send import notification:', error.message);
                    }
                }
            } catch (error) {
                await interaction.reply({ 
                    content: `❌ Failed to import cache: ${error.message}`,
                    ephemeral: true 
                });
            }
        }
    }
    
    if (interaction.commandName === 'accounts') {
        const entries = await getAllAuthCacheEntries();
        
        if (entries.length === 0) {
            await interaction.reply({ 
                content: 'No linked accounts found. Use `/token add` to add a new account.',
                ephemeral: true 
            });
            return;
        }
        
        let message = `🎮 **All Linked Minecraft Accounts (${entries.length})**\n\n`;
        
        for (const entry of entries) {
            const lastUpdated = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'Unknown';
            
            // Calculate expiration (24 hours from last update)
            let expiresAt = 'Unknown';
            let expiresIn = 'Unknown';
            if (entry.updatedAt) {
                const expiryDate = new Date(new Date(entry.updatedAt).getTime() + 24 * 60 * 60 * 1000);
                expiresAt = expiryDate.toLocaleString();
                const now = new Date();
                const diffMs = expiryDate - now;
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                expiresIn = `${diffHours}h ${diffMinutes}m`;
            }
            
            // Get Discord info and name from token data
            let discordMention = 'Unknown';
            let displayName = 'Unknown';
            try {
                const sisuCache = await getAuthCacheEntry(entry.key, 'sisu');
                if (sisuCache && sisuCache.data) {
                    if (sisuCache.data.discordId) {
                        discordMention = `<@${sisuCache.data.discordId}>`;
                    }
                    if (sisuCache.data.name) {
                        displayName = sisuCache.data.name;
                    }
                }
            } catch (error) {
                // Keep defaults
            }
            
            // Get gamertag from cache
            let gamertag = 'Unknown';
            try {
                const xblCache = await getAuthCacheEntry(entry.key, 'xbl');
                if (xblCache && xblCache.data && xblCache.data.userToken && xblCache.data.userToken.DisplayClaims) {
                    const xui = xblCache.data.userToken.DisplayClaims.xui;
                    if (xui && xui[0]) {
                        const uhs = xui[0].uhs;
                        if (uhs) {
                            gamertag = `XUID: ${uhs}`;
                        }
                    }
                }
            } catch (error) {
                // Keep gamertag as Unknown
            }
            
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `👤 **${discordMention}** (${displayName})\n`;
            message += `🔑 Key: \`${entry.key}\`\n`;
            message += `🎮 Gamertag: ${gamertag}\n`;
            message += `🕒 Last updated: ${lastUpdated}\n`;
            message += `⏰ Expires in: ${expiresIn}\n`;
            message += `📅 Expires at: ${expiresAt}\n\n`;
        }
        
        await interaction.reply({ 
            content: message,
            ephemeral: true 
        });
    }
});

client.login(config.token);
