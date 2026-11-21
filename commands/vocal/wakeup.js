const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');

module.exports = {
  name: 'wakeup',
  description: '15 moves aleatoires puis retour',
  usage: '&wakeup <@user>',
  permission: 'Sys+',
  category: 'Vocal',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const target = await message.guild.members.fetch(userId).catch(() => null);
    if (!target?.voice.channel) return message.reply({ embeds: [E.error('Cette personne n\'est pas en vocal.')] });

    const originalChannel = target.voice.channel;
    const voiceChannels = message.guild.channels.cache
      .filter(c => c.isVoiceBased() && c.id !== originalChannel.id && c.joinable)
      .map(c => c);

    if (voiceChannels.length === 0) return message.reply({ embeds: [E.error('Pas assez de vocaux.')] });

    await message.reply({ embeds: [E.info(`🔔 Wakeup de **${target.displayName}** en cours...`)] });

    for (let i = 0; i < 15; i++) {
      const random = voiceChannels[Math.floor(Math.random() * voiceChannels.length)];
      await target.voice.setChannel(random).catch(() => {});
      await new Promise(r => setTimeout(r, 800));
      if (!target.voice.channel) break;
    }

    if (target.voice.channel) {
      await target.voice.setChannel(originalChannel).catch(() => {});
    }

    return message.channel.send({ embeds: [E.success(`Wakeup de **${target.displayName}** termine.`)] });
  },
};
