const E = require('../../utils/embeds');
const { getLeaderboard } = require('../../systems/leveling');

module.exports = {
  name: 'leaderboard',
  aliases: ['lb', 'top'],
  description: 'Classement du serveur',
  usage: '&leaderboard',
  permission: 'Public',
  category: 'Niveaux & Configuration',

  async execute(message) {
    const rows = getLeaderboard.all(message.guild.id, 10);
    if (rows.length === 0) return message.reply({ embeds: [E.info('Aucune donnee.')] });

    const medals = ['🥇', '🥈', '🥉'];
    const lines = rows.map((r, i) => {
      const medal = medals[i] || `**${i + 1}.**`;
      return `${medal} <@${r.user_id}> — Niveau **${r.level}** (${r.xp} XP)`;
    });

    const embed = E.embed()
      .setTitle('🏆 Classement du serveur')
      .setDescription(lines.join('\n'))
      .setFooter({ text: message.guild.name });

    return message.reply({ embeds: [embed] });
  },
};
