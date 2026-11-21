const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const E = require('../../utils/embeds');
const { getPersoByOwner } = require('../../systems/vocaux-perso');

module.exports = {
  name: 'voc',
  description: 'Panel de gestion de ton vocal perso',
  usage: '&voc',
  permission: 'Public',
  category: 'Vocaux perso',

  async execute(message, args, client) {
    const perso = getPersoByOwner.get(message.author.id, message.guild.id);
    if (!perso) return message.reply({ embeds: [E.error('Tu n\'as pas de vocal perso actif.')] });

    const ch = message.guild.channels.cache.get(perso.channel_id);
    if (!ch) return message.reply({ embeds: [E.error('Vocal introuvable.')] });

    const embed = E.embed()
      .setTitle(`🎧 Vocal de ${message.author.username}`)
      .addFields(
        { name: 'Nom', value: ch.name, inline: true },
        { name: 'Membres', value: `${ch.members.size}`, inline: true },
        { name: 'Limite', value: ch.userLimit ? `${ch.userLimit}` : 'Aucune', inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('voc_rename').setLabel('Renommer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('voc_lock').setLabel('Verrouiller').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('voc_unlock').setLabel('Deverrouiller').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('voc_limit').setLabel('Limite').setStyle(ButtonStyle.Secondary),
    );

    const msg = await message.reply({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 60_000, filter: i => i.user.id === message.author.id });

    collector.on('collect', async (i) => {
      if (i.customId === 'voc_lock') {
        await ch.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
        await i.reply({ embeds: [E.success('Vocal verrouille.')], ephemeral: true });
      } else if (i.customId === 'voc_unlock') {
        await ch.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: null });
        await i.reply({ embeds: [E.success('Vocal deverrouille.')], ephemeral: true });
      } else if (i.customId === 'voc_rename') {
        await i.reply({ content: 'Envoie le nouveau nom :', ephemeral: true });
        const collected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 15_000 });
        if (collected.size) {
          await ch.setName(collected.first().content.slice(0, 30));
          collected.first().delete().catch(() => {});
        }
      } else if (i.customId === 'voc_limit') {
        await i.reply({ content: 'Envoie la limite (0 = aucune) :', ephemeral: true });
        const collected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 15_000 });
        if (collected.size) {
          const limit = parseInt(collected.first().content) || 0;
          await ch.setUserLimit(limit);
          collected.first().delete().catch(() => {});
        }
      }
    });
  },
};
