const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const { success, error } = require('../../utils/embeds');
const { parseChannel } = require('../../utils/parsers');

module.exports = {
  name: 'embed',
  description: 'Editeur d\'embeds interactif',
  usage: '&embed [#salon]',
  permission: 'Sys',
  category: 'Utilitaire',

  async execute(message, args) {
    const channelId = parseChannel(args[0]);
    const targetChannel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;

    const data = { title: '', description: '', color: config.accentColor, footer: '', image: '', thumbnail: '' };

    function buildPreview() {
      const e = new EmbedBuilder().setColor(data.color);
      if (data.title) e.setTitle(data.title);
      if (data.description) e.setDescription(data.description);
      if (data.footer) e.setFooter({ text: data.footer });
      if (data.image) e.setImage(data.image);
      if (data.thumbnail) e.setThumbnail(data.thumbnail);
      return e;
    }

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('emb_title').setLabel('Titre').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('emb_desc').setLabel('Description').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('emb_color').setLabel('Couleur').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('emb_footer').setLabel('Footer').setStyle(ButtonStyle.Primary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('emb_image').setLabel('Image').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('emb_thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('emb_send').setLabel('Envoyer').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('emb_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger),
    );

    const msg = await message.reply({ content: '**Editeur d\'embed** — Clique sur un bouton pour modifier.', embeds: [buildPreview()], components: [row1, row2] });

    const collector = msg.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async (i) => {
      if (i.user.id !== message.author.id) return i.reply({ content: 'Ce n\'est pas ton editeur.', ephemeral: true });

      if (i.customId === 'emb_send') {
        collector.stop();
        await targetChannel.send({ embeds: [buildPreview()] });
        return i.update({ content: `✅ Embed envoye dans ${targetChannel}.`, embeds: [], components: [] });
      }

      if (i.customId === 'emb_cancel') {
        collector.stop();
        return i.update({ content: '❌ Annule.', embeds: [], components: [] });
      }

      const fields = { emb_title: 'title', emb_desc: 'description', emb_color: 'color', emb_footer: 'footer', emb_image: 'image', emb_thumb: 'thumbnail' };
      const field = fields[i.customId];
      const labels = { title: 'titre', description: 'description', color: 'couleur (hex: #5865F2)', footer: 'footer', image: 'URL image', thumbnail: 'URL thumbnail' };

      await i.reply({ content: `Envoie le **${labels[field]}** :`, ephemeral: true });

      const response = await message.channel.awaitMessages({
        filter: m => m.author.id === message.author.id,
        max: 1,
        time: 60_000,
      });

      if (response.size > 0) {
        const val = response.first().content;
        response.first().delete().catch(() => {});

        if (field === 'color') {
          const hex = val.replace('#', '');
          data.color = parseInt(hex, 16) || config.accentColor;
        } else {
          data[field] = val;
        }

        msg.edit({ embeds: [buildPreview()] }).catch(() => {});
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
    });
  },
};
