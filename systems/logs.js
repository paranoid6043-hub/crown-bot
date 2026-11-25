const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { db } = require('../database');
const config = require('../config');

const LOG_TYPES = {
  mod: { emoji: '🔨', label: 'Modération', color: config.embedColor },
  messages: { emoji: '💬', label: 'Messages', color: 0x3498DB },
  voice: { emoji: '🎙️', label: 'Vocal', color: 0x9B59B6 },
  members: { emoji: '👥', label: 'Membres', color: 0x2ECC71 },
  server: { emoji: '⚙️', label: 'Serveur', color: 0xE67E22 },
  roles: { emoji: '🏷️', label: 'Rôles', color: 0xE91E63 },
};

function getLogChannel(guild, type) {
  if (!type) type = 'mod';
  const row = db.prepare('SELECT * FROM logs_config WHERE guild_id = ?').get(guild.id);
  if (!row) return null;
  const channelId = row[`${type}_channel`] || row.mod_channel;
  if (!channelId) return null;
  return guild.channels.cache.get(channelId) || null;
}

function getInternalLogChannel(guild) {
  const row = db.prepare('SELECT internal_channel FROM logs_config WHERE guild_id = ?').get(guild.id);
  if (!row || !row.internal_channel) return null;
  return guild.channels.cache.get(row.internal_channel) || null;
}

async function logMod(guild, { action, moderator, target, reason, duration, extra }) {
  const ch = getLogChannel(guild, 'mod');
  if (!ch) return;

  const e = new EmbedBuilder()
    .setColor(LOG_TYPES.mod.color)
    .setTitle(`📋 ${action}`)
    .addFields(
      { name: 'Modérateur', value: `${moderator}`, inline: true },
      { name: 'Cible', value: `${target}`, inline: true },
    )
    .setTimestamp();

  if (reason) e.addFields({ name: 'Raison', value: reason });
  if (duration) e.addFields({ name: 'Durée', value: duration, inline: true });
  if (extra) e.addFields({ name: 'Détails', value: extra });

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

async function logEvent(guild, type, embed) {
  const ch = getLogChannel(guild, type);
  if (!ch) return;
  ch.send({ embeds: [embed] }).catch(() => {});
}

function initAutoLogs(client) {
  client.on('messageDelete', (message) => {
    if (!message.guild || message.author?.bot) return;
    if (!message.content && !message.attachments.size) return;

    const e = new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: message.author?.tag || 'Inconnu', iconURL: message.author?.displayAvatarURL() })
      .setTitle('🗑️ Message supprimé')
      .addFields(
        { name: 'Salon', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Auteur', value: `${message.author || 'Inconnu'}`, inline: true },
      )
      .setTimestamp();

    if (message.content) e.addFields({ name: 'Contenu', value: message.content.slice(0, 1024) });
    if (message.attachments.size) {
      e.addFields({ name: 'Pièces jointes', value: message.attachments.map(a => a.url).join('\n').slice(0, 1024) });
    }

    logEvent(message.guild, 'messages', e);
  });

  client.on('messageUpdate', (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    if (!oldMessage.content && !newMessage.content) return;

    const e = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({ name: newMessage.author?.tag || 'Inconnu', iconURL: newMessage.author?.displayAvatarURL() })
      .setTitle('✏️ Message modifié')
      .addFields(
        { name: 'Salon', value: `<#${newMessage.channel.id}>`, inline: true },
        { name: 'Auteur', value: `${newMessage.author || 'Inconnu'}`, inline: true },
        { name: 'Avant', value: (oldMessage.content || '*vide*').slice(0, 1024) },
        { name: 'Après', value: (newMessage.content || '*vide*').slice(0, 1024) },
      )
      .setTimestamp();

    logEvent(newMessage.guild, 'messages', e);
  });

  client.on('channelCreate', (channel) => {
    if (!channel.guild) return;

    const e = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('📁 Salon créé')
      .addFields(
        { name: 'Salon', value: `${channel} (\`${channel.name}\`)`, inline: true },
        { name: 'Type', value: channelTypeName(channel.type), inline: true },
      )
      .setTimestamp();

    logEvent(channel.guild, 'server', e);
  });

  client.on('channelDelete', (channel) => {
    if (!channel.guild) return;

    const e = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('📁 Salon supprimé')
      .addFields(
        { name: 'Salon', value: `\`${channel.name}\``, inline: true },
        { name: 'Type', value: channelTypeName(channel.type), inline: true },
      )
      .setTimestamp();

    logEvent(channel.guild, 'server', e);
  });

  client.on('channelUpdate', (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    const changes = [];
    if (oldChannel.name !== newChannel.name) changes.push(`**Nom:** \`${oldChannel.name}\` → \`${newChannel.name}\``);
    if (oldChannel.topic !== newChannel.topic) changes.push(`**Description:** modifiée`);
    if (oldChannel.nsfw !== newChannel.nsfw) changes.push(`**NSFW:** ${newChannel.nsfw ? 'activé' : 'désactivé'}`);
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push(`**Slowmode:** ${newChannel.rateLimitPerUser}s`);
    if (!changes.length) return;

    const e = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('📁 Salon modifié')
      .addFields(
        { name: 'Salon', value: `${newChannel}`, inline: true },
        { name: 'Modifications', value: changes.join('\n') },
      )
      .setTimestamp();

    logEvent(newChannel.guild, 'server', e);
  });

  client.on('roleCreate', (role) => {
    const e = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🏷️ Rôle créé')
      .addFields(
        { name: 'Rôle', value: `${role} (\`${role.name}\`)`, inline: true },
        { name: 'Couleur', value: role.hexColor, inline: true },
      )
      .setTimestamp();

    logEvent(role.guild, 'roles', e);
  });

  client.on('roleDelete', (role) => {
    const e = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🏷️ Rôle supprimé')
      .addFields(
        { name: 'Rôle', value: `\`${role.name}\``, inline: true },
        { name: 'Couleur', value: role.hexColor, inline: true },
      )
      .setTimestamp();

    logEvent(role.guild, 'roles', e);
  });

  client.on('roleUpdate', (oldRole, newRole) => {
    const changes = [];
    if (oldRole.name !== newRole.name) changes.push(`**Nom:** \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Couleur:** ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push(`**Permissions:** modifiées`);
    if (!changes.length) return;

    const e = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🏷️ Rôle modifié')
      .addFields(
        { name: 'Rôle', value: `${newRole}`, inline: true },
        { name: 'Modifications', value: changes.join('\n') },
      )
      .setTimestamp();

    logEvent(newRole.guild, 'roles', e);
  });

  client.on('voiceStateUpdate', (oldState, newState) => {
    if (newState.member?.user.bot) return;
    const guild = newState.guild;
    const member = newState.member;
    if (!member) return;

    if (!oldState.channel && newState.channel) {
      logEvent(guild, 'voice', new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`🔊 ${member} a rejoint **${newState.channel.name}**`)
        .setTimestamp());
    } else if (oldState.channel && !newState.channel) {
      logEvent(guild, 'voice', new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription(`🔇 ${member} a quitté **${oldState.channel.name}**`)
        .setTimestamp());
    } else if (oldState.channel && newState.channel && oldState.channelId !== newState.channelId) {
      logEvent(guild, 'voice', new EmbedBuilder()
        .setColor(0xFEE75C)
        .setDescription(`🔀 ${member} a changé de vocal : **${oldState.channel.name}** → **${newState.channel.name}**`)
        .setTimestamp());
    }
  });

  client.on('guildMemberAdd', (member) => {
    const accountAge = Date.now() - member.user.createdTimestamp;
    const days = Math.floor(accountAge / 86400000);

    const e = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setTitle('📥 Membre rejoint')
      .addFields(
        { name: 'Membre', value: `${member} (\`${member.id}\`)`, inline: true },
        { name: 'Compte créé', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R> (${days}j)`, inline: true },
        { name: 'Membres', value: `${member.guild.memberCount}`, inline: true },
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setTimestamp();

    logEvent(member.guild, 'members', e);
  });

  client.on('guildMemberRemove', (member) => {
    const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `${r}`).join(', ');

    const e = new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setTitle('📤 Membre parti')
      .addFields(
        { name: 'Membre', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: 'Membres', value: `${member.guild.memberCount}`, inline: true },
      )
      .setTimestamp();

    if (roles) e.addFields({ name: 'Rôles', value: roles.slice(0, 1024) });

    logEvent(member.guild, 'members', e);
  });

  client.on('guildMemberUpdate', (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size || removedRoles.size) {
      const changes = [];
      if (addedRoles.size) changes.push(`**Ajouté:** ${addedRoles.map(r => `${r}`).join(', ')}`);
      if (removedRoles.size) changes.push(`**Retiré:** ${removedRoles.map(r => `${r}`).join(', ')}`);

      logEvent(newMember.guild, 'roles', new EmbedBuilder()
        .setColor(0xFEE75C)
        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
        .setTitle('🏷️ Rôles modifiés')
        .addFields(
          { name: 'Membre', value: `${newMember}`, inline: true },
          { name: 'Modifications', value: changes.join('\n') },
        )
        .setTimestamp());
    }

    if (oldMember.nickname !== newMember.nickname) {
      logEvent(newMember.guild, 'members', new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📝 Pseudo modifié')
        .addFields(
          { name: 'Membre', value: `${newMember}`, inline: true },
          { name: 'Avant', value: oldMember.nickname || '*aucun*', inline: true },
          { name: 'Après', value: newMember.nickname || '*aucun*', inline: true },
        )
        .setTimestamp());
    }
  });

  client.on('guildBanAdd', (ban) => {
    logEvent(ban.guild, 'mod', new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Membre banni')
      .addFields(
        { name: 'Utilisateur', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: 'Raison', value: ban.reason || 'Aucune raison', inline: true },
      )
      .setTimestamp());
  });

  client.on('guildBanRemove', (ban) => {
    logEvent(ban.guild, 'mod', new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🔓 Membre débanni')
      .addFields(
        { name: 'Utilisateur', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
      )
      .setTimestamp());
  });
}

function channelTypeName(type) {
  const names = { 0: 'Textuel', 2: 'Vocal', 4: 'Catégorie', 5: 'Annonces', 13: 'Stage', 15: 'Forum' };
  return names[type] || 'Autre';
}

module.exports = { logMod, logInternal, logEvent, getLogChannel, initAutoLogs, LOG_TYPES };
