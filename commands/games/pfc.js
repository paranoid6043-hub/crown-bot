const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');

module.exports = {
  name: 'pfc',
  aliases: ['rps', 'chifoumi'],
  description: 'Pierre-Feuille-Ciseaux',
  usage: '&pfc <@user>',
  permission: 'Public',
  category: 'Jeux',

  async execute(message, args) {
    const opponentId = parseUser(args[0]);
    if (!opponentId || opponentId === message.author.id) return message.reply({ embeds: [error('Mentionne un autre membre.')] });

    const opponent = await message.guild.members.fetch(opponentId).catch(() => null);
    if (!opponent || opponent.user.bot) return message.reply({ embeds: [error('Joueur introuvable.')] });

    const choices = {};

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pfc_pierre').setLabel('Pierre').setEmoji('🪨').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pfc_feuille').setLabel('Feuille').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pfc_ciseaux').setLabel('Ciseaux').setEmoji('✂️').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle('✊ Pierre-Feuille-Ciseaux')
      .setDescription(`${message.author} vs ${opponent}\nChoisissez chacun !`);

    const msg = await message.reply({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 30_000 });

    collector.on('collect', async (i) => {
      if (i.user.id !== message.author.id && i.user.id !== opponentId) {
        return i.reply({ content: 'Tu ne participes pas.', ephemeral: true });
      }
      if (choices[i.user.id]) return i.reply({ content: 'Tu as deja choisi !', ephemeral: true });

      choices[i.user.id] = i.customId.split('_')[1];
      await i.reply({ content: `Tu as choisi **${choices[i.user.id]}** !`, ephemeral: true });

      if (Object.keys(choices).length === 2) collector.stop('done');
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') {
        embed.setDescription('⏰ Temps ecoule.');
        return msg.edit({ embeds: [embed], components: [] }).catch(() => {});
      }

      const c1 = choices[message.author.id];
      const c2 = choices[opponentId];
      const emojis = { pierre: '🪨', feuille: '📄', ciseaux: '✂️' };
      const wins = { pierre: 'ciseaux', feuille: 'pierre', ciseaux: 'feuille' };

      let result;
      if (c1 === c2) result = '🤝 Egalite !';
      else if (wins[c1] === c2) result = `🏆 ${message.author} gagne !`;
      else result = `🏆 ${opponent} gagne !`;

      embed.setDescription(`${message.author} ${emojis[c1]} vs ${emojis[c2]} ${opponent}\n\n${result}`);
      msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    });
  },
};
