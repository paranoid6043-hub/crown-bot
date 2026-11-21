const { success, info } = require('../../utils/embeds');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'unmuteall',
  description: 'Unmute tous les membres en vocal',
  usage: '&unmuteall',
  permission: 'Sys+',
  category: 'Moderation',

  async execute(message) {
    const muted = message.guild.members.cache.filter(m => m.voice.serverMute);
    if (muted.size === 0) return message.reply({ embeds: [info('Personne n\'est mute.')] });

    let count = 0;
    for (const [, member] of muted) {
      await member.voice.setMute(false).catch(() => {});
      count++;
    }

    logMod(message.guild, { action: 'Unmute All', moderator: message.author, target: message.guild.name, extra: `${count} membres unmute` });

    message.reply({ embeds: [success(`${count} membres unmute.`)] });
  },
};
