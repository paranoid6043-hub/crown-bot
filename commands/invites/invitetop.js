const { EmbedBuilder } = require('discord.js');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  name: 'invitetop',
  aliases: ['invtop', 'itop'],
  description: 'Classement des invitations',
  usage: '&invitetop',
  permission: 'Public',
  category: 'Invitations',

  async execute(message) {
    const rows = db.prepare('SELECT * FROM invite_data WHERE guild_id = ? ORDER BY invites_count DESC LIMIT ?').all(message.guild.id, 10);

    if (rows.length === 0) {
      return message.reply({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription('Aucune invitation trackee.')] });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const list = rows.map((r, i) => `${medals[i] || `**${i + 1}.**`} <@${r.user_id}> — **${r.invites_count}** invites (${r.invites_left} restantes)`).join('\n');

    const e = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle('📩 Classement Invitations')
      .setDescription(list);

    message.reply({ embeds: [e] });
  },
};
