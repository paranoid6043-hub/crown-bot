const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { parseUser } = require('../../utils/parsers');
const { error } = require('../../utils/embeds');

module.exports = {
  name: 'banner',
  description: 'Affiche la banniere d\'un membre',
  usage: '&banner [@user]',
  permission: 'Public',
  category: 'Utilitaire',

  async execute(message, args) {
    const userId = parseUser(args[0]) || message.author.id;
    const user = await message.client.users.fetch(userId, { force: true }).catch(() => null);
    if (!user) return message.reply({ embeds: [error('Utilisateur introuvable.')] });

    const bannerURL = user.bannerURL({ size: 512 });
    if (!bannerURL) return message.reply({ embeds: [error('Cet utilisateur n\'a pas de banniere.')] });

    const e = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle(`Banniere de ${user.tag}`)
      .setImage(bannerURL);

    message.reply({ embeds: [e] });
  },
};
