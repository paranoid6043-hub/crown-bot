const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { getUser, xpForLevel } = require('../../systems/leveling');

module.exports = {
  name: 'rank',
  description: 'Voir ton niveau',
  usage: '&rank [@user]',
  permission: 'Public',
  category: 'Niveaux & Configuration',

  async execute(message, args) {
    const userId = parseUser(args[0], message) || message.author.id;
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    const data = getUser.get(userId, message.guild.id);
    if (!data) return message.reply({ embeds: [E.info(`${member.displayName} n'a pas encore d'XP.`)] });

    const needed = xpForLevel(data.level);
    const progress = Math.floor((data.xp / needed) * 100);
    const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));

    const embed = E.embed()
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .addFields(
        { name: 'Niveau', value: `${data.level}`, inline: true },
        { name: 'XP', value: `${data.xp} / ${needed}`, inline: true },
        { name: 'Messages', value: `${data.messages}`, inline: true },
        { name: 'Progression', value: `${bar} ${progress}%` },
      );

    return message.reply({ embeds: [embed] });
  },
};
