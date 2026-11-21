const { baseEmbed } = require('../../utils/help-menu');
module.exports = {
  name: 'ping', description: 'Voir la latence du bot et de sa connexion Discord',
  usage: '&ping', permission: 'Public', category: 'Utilitaire',
  async execute(message, args, client) {
    const started = Date.now();
    const reply = await message.reply({ content: '◌ Mesure de la latence…', allowedMentions: { repliedUser: false } });
    const elapsed = Date.now() - started;
    const websocket = Number.isFinite(client.ws.ping) && client.ws.ping >= 0 ? `${Math.round(client.ws.ping)} ms` : 'En cours de mesure';
    return reply.edit({ content: '', embeds: [baseEmbed({ client, guild: message.guild }).setTitle('🏓 Pong')
      .setDescription('État de la connexion avec Discord.')
      .addFields({ name: 'Aller-retour du message', value: `**${elapsed} ms**`, inline: true },
        { name: 'Connexion Discord', value: `**${websocket}**`, inline: true })] });
  },
};
