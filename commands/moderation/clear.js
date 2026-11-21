const { success, error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');
const { logMod } = require('../../systems/logs');

module.exports = {
  name: 'clear',
  aliases: ['purge'],
  description: 'Supprime des messages',
  usage: '&clear <nombre> [@user]',
  permission: 'Sys',
  category: 'Moderation',

  async execute(message, args) {
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) return message.reply({ embeds: [error('Nombre entre 1 et 100.')] });

    const userId = parseUser(args[1]);

    await message.delete().catch(() => {});

    let messages = await message.channel.messages.fetch({ limit: userId ? 100 : amount });
    if (userId) {
      messages = messages.filter(m => m.author.id === userId);
      messages = [...messages.values()].slice(0, amount);
    }

    const deleted = await message.channel.bulkDelete(messages, true).catch(() => null);
    if (!deleted) return message.channel.send({ embeds: [error('Impossible de supprimer (messages > 14 jours?).')] });

    logMod(message.guild, { action: 'Clear', moderator: message.author, target: userId ? `<@${userId}>` : message.channel, extra: `${deleted.size} messages supprimes` });

    message.channel.send({ embeds: [success(`${deleted.size} messages supprimes.`)] }).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
  },
};
