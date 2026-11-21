const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { parseUser } = require('../../utils/parsers');

module.exports = {
  name: 'avatar',
  aliases: ['av', 'pp'],
  description: 'Affiche l\'avatar d\'un membre',
  usage: '&avatar [@user]',
  permission: 'Public',
  category: 'Utilitaire',

  async execute(message, args) {
    const userId = parseUser(args[0]) || message.author.id;
    const user = await message.client.users.fetch(userId, { force: true }).catch(() => null);
    if (!user) return message.reply({ embeds: [require('../../utils/embeds').error('Utilisateur introuvable.')] });

    const member = message.guild.members.cache.get(userId);
    const serverAv = member?.displayAvatarURL({ size: 512 });
    const globalAv = user.displayAvatarURL({ size: 512 });

    const e = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle(`Avatar de ${user.tag}`)
      .setImage(globalAv);

    if (serverAv && serverAv !== globalAv) {
      e.setThumbnail(serverAv);
      e.setDescription('[Global](' + globalAv + ') | [Serveur](' + serverAv + ')');
    }

    message.reply({ embeds: [e] });
  },
};
