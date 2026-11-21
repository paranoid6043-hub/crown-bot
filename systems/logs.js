const { EmbedBuilder } = require('discord.js');
const { db } = require('../database');
const config = require('../config');

function getLogChannel(guild) {
  const row = db.prepare('SELECT mod_channel FROM logs_config WHERE guild_id = ?').get(guild.id);
  if (!row) return null;
  return guild.channels.cache.get(row.mod_channel) || null;
}

function getInternalLogChannel(guild) {
  const row = db.prepare('SELECT internal_channel FROM logs_config WHERE guild_id = ?').get(guild.id);
  if (!row || !row.internal_channel) return null;
  return guild.channels.cache.get(row.internal_channel) || null;
}

async function logMod(guild, { action, moderator, target, reason, duration, extra }) {
  const ch = getLogChannel(guild);
  if (!ch) return;

  const e = new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(`📋 ${action}`)
    .addFields(
      { name: 'Moderateur', value: `${moderator}`, inline: true },
      { name: 'Cible', value: `${target}`, inline: true },
    )
    .setTimestamp();

  if (reason) e.addFields({ name: 'Raison', value: reason });
  if (duration) e.addFields({ name: 'Duree', value: duration, inline: true });
  if (extra) e.addFields({ name: 'Details', value: extra });

  ch.send({ embeds: [e] }).catch(() => {});
}

async function logInternal(guild, { action, user, details }) {
  const ch = getInternalLogChannel(guild);
  if (!ch) return;

  const e = new EmbedBuilder()
    .setColor(0x99AAB5)
    .setDescription(`⚙️ **${action}** par ${user}\n${details || ''}`)
    .setTimestamp();

  ch.send({ embeds: [e] }).catch(() => {});
}

module.exports = { logMod, logInternal, getLogChannel };
