const { catalogue, uptime, baseEmbed } = require('../../utils/help-menu');
module.exports = {
  name: 'botinfo', aliases: ['about', 'infosbot'], description: 'Informations et état du bot',
  usage: '&botinfo', permission: 'Public', category: 'Utilitaire',
  async execute(message, args, client) {
    const commands = catalogue(client);
    const ping = Number.isFinite(client.ws.ping) && client.ws.ping >= 0 ? `${Math.round(client.ws.ping)} ms` : 'Mesure en cours';
    return message.reply({ embeds: [baseEmbed({ client, guild: message.guild }).setTitle('✦ Informations du bot')
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .setDescription('Protection, support et outils pour ton serveur.\nOuvre `&help` pour parcourir toutes les commandes.')
      .addFields({ name: 'Commandes', value: String(commands.length), inline: true },
        { name: 'Catégories', value: String(new Set(commands.map(c => c.group)).size), inline: true },
        { name: 'Connexion', value: ping, inline: true },
        { name: 'En ligne depuis', value: uptime(client.uptime), inline: true },
        { name: 'Préfixe', value: '`&`', inline: true },
        { name: 'Prise en main', value: '`&guide`', inline: true })], allowedMentions: { parse: [], repliedUser: false } });
  },
};
