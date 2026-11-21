const { PermissionFlagsBits } = require('discord.js');
const { success } = require('../../utils/embeds');
const { parseChannel } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'unhide',
  description: 'Rend un salon visible',
  usage: '&unhide [#salon] | &unhide all',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    if (args[0]?.toLowerCase() === 'all') {
      const channels = message.guild.channels.cache.filter(c => c.manageable);
      let count = 0;
      for (const [, ch] of channels) {
        await ch.permissionOverwrites.edit(message.guild.id, { ViewChannel: null }).catch(() => {});
        count++;
      }
      logMod(message.guild, { action: 'Unhide All', moderator: message.author, target: message.guild.name, extra: `${count} salons` });
      return message.reply({ embeds: [success(`${count} salons rendus visibles.`)] });
    }

    const channelId = parseChannel(args[0]);
    const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;

    await channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: null }).catch(() => {});

    logMod(message.guild, { action: 'Unhide', moderator: message.author, target: channel.name });

    message.reply({ embeds: [success(`${channel} est maintenant visible.`)] });
  },
};
