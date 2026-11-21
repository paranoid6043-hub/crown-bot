const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { getUserLevel, getLevelEmoji } = require('../../utils/permissions');
const { db } = require('../../database');

module.exports = {
  name: 'userinfo',
  description: 'Infos sur un membre',
  usage: '&userinfo [@user]',
  permission: 'Public',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    const userId = parseUser(args[0], message) || message.author.id;
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    const level = getUserLevel(userId, message.guild);
    const emoji = getLevelEmoji(level);
    const sanctions = db.prepare('SELECT COUNT(*) as c FROM sanctions WHERE user_id = ? AND guild_id = ?').get(userId, message.guild.id);
    const xpData = db.prepare('SELECT * FROM levels WHERE user_id = ? AND guild_id = ?').get(userId, message.guild.id);

    const roles = member.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString())
      .slice(0, 10)
      .join(', ') || 'Aucun';

    const embed = E.embed()
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Niveau bot', value: `${emoji} ${level}`, inline: true },
        { name: 'ID', value: userId, inline: true },
        { name: 'Pseudo', value: member.displayName, inline: true },
        { name: 'Compte cree', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'A rejoint', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Sanctions', value: `${sanctions.c}`, inline: true },
      );

    if (xpData) {
      embed.addFields(
        { name: 'Niveau XP', value: `${xpData.level}`, inline: true },
        { name: 'XP', value: `${xpData.xp}`, inline: true },
        { name: 'Messages', value: `${xpData.messages}`, inline: true },
      );
    }

    embed.addFields({ name: `Roles (${member.roles.cache.size - 1})`, value: roles });

    return message.reply({ embeds: [embed] });
  },
};
