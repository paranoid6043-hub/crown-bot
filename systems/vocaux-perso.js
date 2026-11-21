const { ChannelType, PermissionsBitField } = require('discord.js');
const { db } = require('../database');

const getConfig = db.prepare('SELECT * FROM vocaux_perso_config WHERE guild_id = ?');
const getPerso = db.prepare('SELECT * FROM vocaux_perso WHERE channel_id = ?');
const getPersoByOwner = db.prepare('SELECT * FROM vocaux_perso WHERE owner_id = ? AND guild_id = ?');
const createPerso = db.prepare('INSERT OR REPLACE INTO vocaux_perso (channel_id, guild_id, owner_id) VALUES (?, ?, ?)');
const deletePerso = db.prepare('DELETE FROM vocaux_perso WHERE channel_id = ?');

async function handleVoicePerso(oldState, newState, client) {
  const guild = newState.guild || oldState.guild;
  const conf = getConfig.get(guild.id);
  if (!conf) return;

  if (newState.channelId === conf.create_channel_id && newState.member) {
    const existing = getPersoByOwner.get(newState.member.id, guild.id);
    if (existing) {
      const ch = guild.channels.cache.get(existing.channel_id);
      if (ch) {
        await newState.member.voice.setChannel(ch).catch(() => {});
        return;
      }
      deletePerso.run(existing.channel_id);
    }

    const channel = await guild.channels.create({
      name: `🎧 ${newState.member.displayName}`,
      type: ChannelType.GuildVoice,
      parent: conf.category_id,
      permissionOverwrites: [
        {
          id: newState.member.id,
          allow: [
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.MoveMembers,
            PermissionsBitField.Flags.MuteMembers,
            PermissionsBitField.Flags.DeafenMembers,
          ],
        },
      ],
    });

    createPerso.run(channel.id, guild.id, newState.member.id);
    await newState.member.voice.setChannel(channel).catch(() => {});
  }

  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    const perso = getPerso.get(oldState.channelId);
    if (perso) {
      const ch = guild.channels.cache.get(oldState.channelId);
      if (ch && ch.members.size === 0) {
        deletePerso.run(oldState.channelId);
        await ch.delete().catch(() => {});
      }
    }
  }
}

module.exports = { handleVoicePerso, getConfig, getPerso, getPersoByOwner, createPerso, deletePerso };
