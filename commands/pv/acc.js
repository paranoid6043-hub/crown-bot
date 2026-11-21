const { parseUser } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

module.exports = {
  name: 'acc',
  description: 'Toggle acces au PV (proprietaire du PV)',
  usage: '&acc <@user>',
  permission: 'Public',
  category: 'Vocaux prives (PV)',

  async execute(message, args) {
    const member = message.guild.members.cache.get(message.author.id);
    if (!member?.voice.channel) return message.reply({ embeds: [E.error('Tu dois etre en vocal.')] });

    const pv = db.prepare('SELECT * FROM private_vocals WHERE channel_id = ?').get(member.voice.channel.id);
    if (!pv) return message.reply({ embeds: [E.error('Ce vocal n\'est pas un PV.')] });
    if (pv.owner_id !== message.author.id) return message.reply({ embeds: [E.error('Tu n\'es pas le proprietaire de ce PV.')] });

    const userId = parseUser(args[0], message);
    if (!userId) return message.reply({ embeds: [E.error('Mentionne un membre.')] });

    const target = await message.guild.members.fetch(userId).catch(() => null);
    if (!target) return message.reply({ embeds: [E.error('Membre introuvable.')] });

    const vc = member.voice.channel;
    const perms = vc.permissionOverwrites.cache.get(userId);
    const hasAccess = perms?.allow.has('Connect');

    if (hasAccess) {
      await vc.permissionOverwrites.delete(userId);
      return message.reply({ embeds: [E.success(`Acces retire pour **${target.displayName}**.`)] });
    }

    await vc.permissionOverwrites.edit(userId, { Connect: true });
    return message.reply({ embeds: [E.success(`Acces donne a **${target.displayName}**.`)] });
  },
};
