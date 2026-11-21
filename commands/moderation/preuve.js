const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'preuve',
  description: 'Envoie la preuve au salon staff (en reponse)',
  usage: '&preuve (en reponse a un message)',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message) {
    const ref = message.reference;
    if (!ref) return message.reply({ embeds: [E.error('Reponds a un message pour envoyer la preuve.')] });

    const config = db.prepare('SELECT staff_channel_id FROM staff_config WHERE guild_id = ?').get(message.guild.id);
    if (!config?.staff_channel_id) return message.reply({ embeds: [E.error('Aucun salon staff configure (`&salonstaff #salon`).')] });

    const staffChannel = message.guild.channels.cache.get(config.staff_channel_id);
    if (!staffChannel) return message.reply({ embeds: [E.error('Salon staff introuvable.')] });

    const target = await message.channel.messages.fetch(ref.messageId).catch(() => null);
    if (!target) return message.reply({ embeds: [E.error('Message introuvable.')] });

    const embed = E.embed()
      .setTitle('📸 Preuve')
      .setColor(0xFF6B6B)
      .addFields(
        { name: 'Auteur', value: `${target.author} (${target.author.tag})`, inline: true },
        { name: 'Salon', value: `${message.channel}`, inline: true },
        { name: 'Signale par', value: `${message.author}`, inline: true },
        { name: 'Contenu', value: target.content?.slice(0, 1024) || '*Aucun texte*' },
      )
      .setTimestamp();

    const attachments = [...target.attachments.values()];
    const files = attachments.map(a => a.url);

    await staffChannel.send({ embeds: [embed], files: files.slice(0, 5) });
    await message.reply({ embeds: [E.success('Preuve envoyee au staff.')] });
    await message.delete().catch(() => {});
  },
};
