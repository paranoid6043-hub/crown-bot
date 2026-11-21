const E = require('../../utils/embeds');

module.exports = {
  name: 'vc',
  description: 'Nombre de membres en vocal',
  usage: '&vc',
  permission: 'Public',
  category: 'Vocal',

  async execute(message) {
    const voiceChannels = message.guild.channels.cache.filter(c => c.isVoiceBased());
    let total = 0;
    const lines = [];

    for (const [, ch] of voiceChannels) {
      if (ch.members.size > 0) {
        lines.push(`🔊 **${ch.name}** — ${ch.members.size} membre(s)`);
        total += ch.members.size;
      }
    }

    const embed = E.embed()
      .setTitle('🎤 Membres en vocal')
      .setDescription(lines.length ? lines.join('\n') : 'Personne en vocal.')
      .setFooter({ text: `Total : ${total} membre(s)` });

    return message.reply({ embeds: [embed] });
  },
};
