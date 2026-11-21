const { EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'serverinfo',
  aliases: ['si', 'serveur'],
  description: 'Infos sur le serveur',
  usage: '&serverinfo',
  permission: 'Public',
  category: 'Utilitaire',

  async execute(message) {
    const { guild } = message;
    await guild.members.fetch().catch(() => {});

    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const online = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.memberCount - bots;

    const e = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: '👑 Proprietaire', value: `<@${guild.ownerId}>`, inline: true },
        { name: '📅 Cree le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '🆔 ID', value: guild.id, inline: true },
        { name: `👥 Membres (${guild.memberCount})`, value: `Humains: ${humans}\nBots: ${bots}\nEn ligne: ${online}`, inline: true },
        { name: `💬 Salons (${guild.channels.cache.size})`, value: `Textuels: ${textChannels}\nVocaux: ${voiceChannels}\nCategories: ${categories}`, inline: true },
        { name: `🏷️ Roles`, value: `${guild.roles.cache.size}`, inline: true },
        { name: '🔒 Verification', value: guild.verificationLevel.toString(), inline: true },
        { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount || 0} (Niveau ${guild.premiumTier})`, inline: true },
      );

    if (guild.bannerURL()) e.setImage(guild.bannerURL({ size: 512 }));

    message.reply({ embeds: [e] });
  },
};
