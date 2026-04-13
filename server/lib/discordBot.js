import { log } from '../logger.js';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_API = 'https://discord.com/api/v10';

/**
 * Makes an authenticated request to the Discord API using the Bot Token.
 */
async function discordApiRequest(endpoint) {
    if (!DISCORD_BOT_TOKEN) {
        throw new Error('DISCORD_BOT_TOKEN is not configured');
    }

    const url = `${DISCORD_API}${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API Error ${response.status}: ${errorText}`);
    }

    return response.json();
}

/**
 * Fetches all members of the configured guild.
 * Uses pagination to get all members (Discord limits to 1000 per request).
 */
export async function fetchGuildMembers() {
    if (!DISCORD_GUILD_ID) {
        throw new Error('DISCORD_GUILD_ID is not configured');
    }

    log('API', `Fetching guild members for guild ${DISCORD_GUILD_ID}...`);

    let allMembers = [];
    let after = '0';
    let hasMore = true;

    while (hasMore) {
        const members = await discordApiRequest(
            `/guilds/${DISCORD_GUILD_ID}/members?limit=1000&after=${after}`
        );

        if (members.length === 0) {
            hasMore = false;
        } else {
            allMembers = allMembers.concat(members);
            after = members[members.length - 1].user.id;

            // Discord returns less than 1000 when we've reached the end
            if (members.length < 1000) {
                hasMore = false;
            }
        }
    }

    log('API', `Fetched ${allMembers.length} guild members`);

    return allMembers.map(member => ({
        discord_id: member.user.id,
        username: member.user.username,
        display_name: member.nick || member.user.global_name || null,
        avatar: member.user.avatar,
        roles: member.roles || [],
        joined_at: member.joined_at || null,
        is_bot: member.user.bot || false,
    }));
}

/**
 * Fetches all roles of the configured guild.
 */
export async function fetchGuildRoles() {
    if (!DISCORD_GUILD_ID) {
        throw new Error('DISCORD_GUILD_ID is not configured');
    }

    log('API', `Fetching guild roles for guild ${DISCORD_GUILD_ID}...`);

    const roles = await discordApiRequest(`/guilds/${DISCORD_GUILD_ID}/roles`);

    log('API', `Fetched ${roles.length} guild roles`);

    // Sort by position descending (highest role first)
    return roles
        .filter(r => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(role => ({
            role_id: role.id,
            name: role.name,
            color: role.color,
            position: role.position,
        }));
}
