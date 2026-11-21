const E = require('../../utils/embeds');
const { db } = require('../../database');
const { listByLevel, getLevelEmoji } = require('../../utils/permissions');
const config = require('../../config');

module.exports = {
  name: 'setup',
  description: 'Panel de configuration des acces',
  usage: '&setup',
  permission: 'Sys+',
  category: 'Niveaux & Configuration',

  async execute(message) {
    const lines = [];

    for (const level of [...config.hierarchy].reverse()) {
      if (level === 'Public') continue;
      const users = listByLevel.all(message.guild.id, level);
      const emoji = getLevelEmoji(level);
      const mentions = users.map(u => `<@${u.user_id}>`).join(', ') || '*Aucun*';
      lines.push(`${emoji} **${level}** (${users.length})\n${mentions}`);
    }

    if (message.guild.ownerId) {
      lines.unshift(`👑 **Proprietaire du serveur** : <@${message.guild.ownerId}> (Sys+ auto)`);
    }

    const embed = E.embed()
      .setTitle('⚙️ Configuration des acces')
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Hierarchie : ${config.hierarchy.join(' > ')}` });

    return message.reply({ embeds: [embed] });
  },
};
