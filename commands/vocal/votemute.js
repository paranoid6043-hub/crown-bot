const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'votemute',
  description: 'Vote du vocal : mute 5 min si la majorite dit oui',
  usage: '&votemute <@user>',
  permission: 'Public',
  category: 'Vocal',

  async execute(message, args) {
    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const target = await message.guild.members.fetch(userId).catch(() => null);
    if (!target?.voice.channel) return message.reply({ embeds: [E.error('Cette personne n\'est pas en vocal.')] });

    const vc = target.voice.channel;
    const needed = Math.ceil(vc.members.size / 2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('votemute_yes').setLabel(`Oui (0/${needed})`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('votemute_no').setLabel('Non (0)').setStyle(ButtonStyle.Danger),
    );

    const embed = E.embed()
      .setTitle('🗳️ Vote Mute')
      .setDescription(`Faut-il mute **${target.displayName}** pendant 5 minutes ?\nMembres en vocal : **${vc.members.size}** — Votes requis : **${needed}**`)
      .setFooter({ text: 'Vote expire dans 30 secondes' });

    const msg = await message.reply({ embeds: [embed], components: [row] });

    const yesVoters = new Set();
    const noVoters = new Set();

    const collector = msg.createMessageComponentCollector({ time: 30_000 });

    collector.on('collect', async (i) => {
      if (!vc.members.has(i.user.id)) {
        return i.reply({ content: 'Tu dois etre dans le vocal.', ephemeral: true });
      }

      yesVoters.delete(i.user.id);
      noVoters.delete(i.user.id);

      if (i.customId === 'votemute_yes') yesVoters.add(i.user.id);
      else noVoters.add(i.user.id);

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('votemute_yes').setLabel(`Oui (${yesVoters.size}/${needed})`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('votemute_no').setLabel(`Non (${noVoters.size})`).setStyle(ButtonStyle.Danger),
      );

      await i.update({ components: [updatedRow] });

      if (yesVoters.size >= needed) collector.stop('passed');
    });

    collector.on('end', async (_, reason) => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('votemute_yes').setLabel(`Oui (${yesVoters.size})`).setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('votemute_no').setLabel(`Non (${noVoters.size})`).setStyle(ButtonStyle.Danger).setDisabled(true),
      );

      if (reason === 'passed') {
        await target.voice.setMute(true).catch(() => {});
        setTimeout(() => target.voice.setMute(false).catch(() => {}), 300_000);
        const result = E.success(`**${target.displayName}** a ete mute pour 5 minutes par vote.`);
        await msg.edit({ embeds: [result], components: [disabledRow] });
      } else {
        const result = E.error(`Vote echoue — pas assez de votes pour mute **${target.displayName}**.`);
        await msg.edit({ embeds: [result], components: [disabledRow] });
      }
    });
  },
};
