const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { info } = require('../../utils/embeds');

module.exports = {
  name: 'mutelist',
  description: 'Liste des membres mutes en vocal',
  usage: '&mutelist',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message) {
    const members = message.guild.members.cache.filter(m => m.voice.serverMute);

    if (members.size === 0) return message.reply({ embeds: [info('Aucun membre mute en vocal.')] });

    const list = members.map(m => `• ${m.user.tag}`).join('\n');

    const e = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('🔇 Membres mutes en vocal')
      .setDescription(list)
      .setFooter({ text: `${members.size} membre(s)` });

    message.reply({ embeds: [e] });
  },
};
