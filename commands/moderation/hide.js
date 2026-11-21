const { PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const { parseChannel } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'hide',
  description: 'Cache un salon ou une categorie',
  usage: '&hide [#salon] | &hide all',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    if (args[0]?.toLowerCase() === 'all') {
      const channels = message.guild.channels.cache.filter(c => c.manageable);
      let count = 0;
      for (const [, ch] of channels) {
        await ch.permissionOverwrites.edit(message.guild.id, { ViewChannel: false }).catch(() => {});
        count++;
      }
      logMod(message.guild, { action: 'Hide All', moderator: message.author, target: message.guild.name, extra: `${count} salons caches` });
      return message.reply({ embeds: [success(`${count} salons caches.`)] });
    }

    const channelId = parseChannel(args[0]);
    const channel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;

    await channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false }).catch(() => {});

    logMod(message.guild, { action: 'Hide', moderator: message.author, target: channel.name });

    message.reply({ embeds: [success(`${channel} est maintenant cache.`)] });
  },
};
