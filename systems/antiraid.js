const { db } = require('../database');

const spamCache = new Map();
const linkRegex = /https?:\/\/[^\s]+|discord\.gg\/[^\s]+|\.gg\/[^\s]+/i;

function getConfig(guildId) {
  return db.prepare('SELECT * FROM antiraid_config WHERE guild_id = ?').get(guildId);
}

async function handleAntiraid(message) {
  if (message.author.bot || !message.guild) return false;
  if (!message.member) return false;

  const { hasPermission } = require('../utils/permissions');
  if (hasPermission(message.author.id, message.guild, 'Sys')) return false;

  const cfg = getConfig(message.guild.id);
  if (!cfg) return false;

  if (cfg.antilink) {
    if (linkRegex.test(message.content)) {
      await message.delete().catch(() => {});
      const action = cfg.antilink_action || 'delete';
      if (action === 'timeout') {
        await message.member.timeout(60000, 'Antilink').catch(() => {});
      }
      message.channel.send(`⛔ ${message.author}, les liens ne sont pas autorises ici.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
      return true;
    }
  }

  if (cfg.antimention) {
    const limit = cfg.antimention_limit || 5;
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    if (mentions >= limit) {
      await message.delete().catch(() => {});
      const action = cfg.antimention_action || 'timeout';
      if (action === 'timeout') {
        await message.member.timeout(300000, 'Anti-mention mass').catch(() => {});
      }
      message.channel.send(`⛔ ${message.author}, trop de mentions.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
      return true;
    }
  }

  if (cfg.antispam) {
    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    const window = (cfg.antispam_time || 5) * 1000;
    const limit = cfg.antispam_limit || 5;

    if (!spamCache.has(key)) spamCache.set(key, []);
    const timestamps = spamCache.get(key);
    timestamps.push(now);

    const recent = timestamps.filter(t => now - t < window);
    spamCache.set(key, recent);

    if (recent.length >= limit) {
      spamCache.set(key, []);
      await message.member.timeout(300000, 'Antispam').catch(() => {});
      message.channel.send(`⛔ ${message.author} a ete mute pour spam.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
      return true;
    }
  }

  return false;
}

function init(client) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of spamCache) {
      const recent = timestamps.filter(t => now - t < 30000);
      if (recent.length === 0) spamCache.delete(key);
      else spamCache.set(key, recent);
    }
  }, 60000);
}

module.exports = { handleAntiraid, getConfig, init };
