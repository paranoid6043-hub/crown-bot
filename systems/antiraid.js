const { EmbedBuilder, PermissionsBitField, AuditLogEvent } = require('discord.js');
const { db } = require('../database');
const config = require('../config');

const spamCache = new Map();
const mentionCache = new Map();
const joinCache = new Map();
const linkRegex = /https?:\/\/[^\s]+|discord\.gg\/[^\s]+|\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+|discordapp\.com\/invite\/[^\s]+/i;
const inviteRegex = /discord\.gg\/[^\s]+|\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+|discordapp\.com\/invite\/[^\s]+/i;

function getConfig(guildId) {
  return db.prepare('SELECT * FROM antiraid_config WHERE guild_id = ?').get(guildId);
}

function isWhitelisted(message, cfg) {
  if (!cfg) return false;

  const wlChannels = getWhitelistChannels(message.guild.id);
  if (wlChannels.some(w => w.target_id === message.channel.id)) return true;

  const wlRoles = getWhitelistRoles(message.guild.id);
  if (message.member && wlRoles.some(w => message.member.roles.cache.has(w.target_id))) return true;

  return false;
}

function getWhitelistChannels(guildId) {
  return db.prepare('SELECT * FROM antiraid_whitelist WHERE guild_id = ? AND type = ?').all(guildId, 'channel');
}

function getWhitelistRoles(guildId) {
  return db.prepare('SELECT * FROM antiraid_whitelist WHERE guild_id = ? AND type = ?').all(guildId, 'role');
}

async function sendAntiraidLog(guild, { type, user, action, reason, details }) {
  const { logMod } = require('./logs');
  await logMod(guild, {
    action: `🛡️ Anti-Raid | ${type}`,
    moderator: guild.client.user,
    target: user,
    reason,
    extra: details,
  });
}

async function handleAntiraid(message) {
  if (message.author.bot || !message.guild) return false;
  if (!message.member) return false;

  const { hasPermission } = require('../utils/permissions');
  if (hasPermission(message.author.id, message.guild, 'Sys')) return false;

  const cfg = getConfig(message.guild.id);
  if (!cfg) return false;

  if (isWhitelisted(message, cfg)) return false;

  if (cfg.antilink && linkRegex.test(message.content)) {
    await message.delete().catch(() => {});
    const action = cfg.antilink_action || 'delete';
    if (action === 'timeout') {
      const duration = (cfg.antilink_duration || 5) * 60 * 1000;
      await message.member.timeout(duration, 'Antilink').catch(() => {});
    } else if (action === 'kick') {
      await message.member.kick('Antilink').catch(() => {});
    } else if (action === 'ban') {
      await message.member.ban({ reason: 'Antilink', deleteMessageSeconds: 60 }).catch(() => {});
    }
    const warn = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(config.errorColor)
        .setDescription(`⛔ ${message.author} — les liens ne sont pas autorisés ici.`)
        .setFooter({ text: `Action: ${action}` })],
    }).catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
    await sendAntiraidLog(message.guild, {
      type: 'Antilink',
      user: message.author,
      action,
      reason: 'Lien détecté',
      details: `Salon: <#${message.channel.id}>\nContenu supprimé`,
    });
    return true;
  }

  if (cfg.antimention) {
    const limit = cfg.antimention_limit || 5;
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    if (mentions >= limit) {
      await message.delete().catch(() => {});
      const action = cfg.antimention_action || 'timeout';
      const duration = (cfg.antimention_duration || 10) * 60 * 1000;
      if (action === 'timeout') {
        await message.member.timeout(duration, 'Anti-mention mass').catch(() => {});
      } else if (action === 'kick') {
        await message.member.kick('Anti-mention mass').catch(() => {});
      } else if (action === 'ban') {
        await message.member.ban({ reason: 'Anti-mention mass', deleteMessageSeconds: 60 }).catch(() => {});
      }
      const warn = await message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(config.errorColor)
          .setDescription(`⛔ ${message.author} — trop de mentions (${mentions}/${limit}).`)
          .setFooter({ text: `Action: ${action}` })],
      }).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
      await sendAntiraidLog(message.guild, {
        type: 'Anti-mention',
        user: message.author,
        action,
        reason: `${mentions} mentions (limite: ${limit})`,
      });
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
    timestamps.push({ time: now, channelId: message.channel.id, messageId: message.id });

    const recent = timestamps.filter(t => now - t.time < window);
    spamCache.set(key, recent);

    if (recent.length >= limit) {
      spamCache.set(key, []);
      const action = cfg.antispam_action || 'timeout';
      const duration = (cfg.antispam_duration || 5) * 60 * 1000;

      for (const msg of recent) {
        const ch = message.guild.channels.cache.get(msg.channelId);
        if (ch) ch.messages.delete(msg.messageId).catch(() => {});
      }

      if (action === 'timeout') {
        await message.member.timeout(duration, 'Antispam').catch(() => {});
      } else if (action === 'kick') {
        await message.member.kick('Antispam').catch(() => {});
      } else if (action === 'ban') {
        await message.member.ban({ reason: 'Antispam', deleteMessageSeconds: 60 }).catch(() => {});
      } else if (action === 'mute') {
        await message.member.timeout(duration, 'Antispam').catch(() => {});
      }

      const warn = await message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(config.errorColor)
          .setDescription(`⛔ ${message.author} a été sanctionné pour spam.`)
          .setFooter({ text: `Action: ${action} | ${limit} msgs en ${cfg.antispam_time || 5}s` })],
      }).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
      await sendAntiraidLog(message.guild, {
        type: 'Antispam',
        user: message.author,
        action,
        reason: `${limit} messages en ${cfg.antispam_time || 5}s`,
        details: `Salon: <#${message.channel.id}>`,
      });
      return true;
    }
  }

  if (cfg.anticaps) {
    const text = message.content.replace(/[^a-zA-Z]/g, '');
    const capsRatio = text.length > 0 ? (text.replace(/[^A-Z]/g, '').length / text.length) : 0;
    if (text.length >= 8 && capsRatio >= (cfg.anticaps_ratio || 0.7)) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(config.errorColor)
          .setDescription(`⛔ ${message.author} — pas de majuscules excessives.`)],
      }).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
      return true;
    }
  }

  if (cfg.antiemoji) {
    const emojiCount = (message.content.match(/<a?:\w+:\d+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu) || []).length;
    if (emojiCount >= (cfg.antiemoji_limit || 10)) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(config.errorColor)
          .setDescription(`⛔ ${message.author} — trop d'emojis (${emojiCount}/${cfg.antiemoji_limit || 10}).`)],
      }).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
      return true;
    }
  }

  return false;
}

function handleMemberJoin(member) {
  const cfg = getConfig(member.guild.id);
  if (!cfg) return;

  if (cfg.antijoin) {
    const key = member.guild.id;
    const now = Date.now();
    const window = (cfg.antijoin_time || 10) * 1000;
    const limit = cfg.antijoin_limit || 5;

    if (!joinCache.has(key)) joinCache.set(key, []);
    const joins = joinCache.get(key);
    joins.push({ time: now, memberId: member.id });

    const recent = joins.filter(j => now - j.time < window);
    joinCache.set(key, recent);

    if (recent.length >= limit) {
      joinCache.set(key, []);
      for (const j of recent) {
        const m = member.guild.members.cache.get(j.memberId);
        if (m) m.kick('Anti mass-join').catch(() => {});
      }
      sendAntiraidLog(member.guild, {
        type: 'Anti-MassJoin',
        user: member.user,
        action: 'kick',
        reason: `${recent.length} joins en ${cfg.antijoin_time || 10}s`,
        details: `${recent.length} membres expulsés`,
      });
    }
  }
}

function init(client) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of spamCache) {
      const recent = timestamps.filter(t => now - t.time < 30000);
      if (recent.length === 0) spamCache.delete(key);
      else spamCache.set(key, recent);
    }
    for (const [key, joins] of joinCache) {
      const recent = joins.filter(j => now - j.time < 60000);
      if (recent.length === 0) joinCache.delete(key);
      else joinCache.set(key, recent);
    }
  }, 60000);

  client.on('guildMemberAdd', (member) => {
    handleMemberJoin(member);
  });
}

module.exports = { handleAntiraid, getConfig, init, handleMemberJoin };
