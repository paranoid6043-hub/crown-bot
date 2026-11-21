const welcome = require('../../systems/welcome');
const E = require('../../utils/embeds');
module.exports = {
  name: 'welcome', aliases: ['bienvenue'], description: 'Configurer la bienvenue et le rôle automatique',
  usage: '&welcome setup | test | on | off', permission: 'Public', category: 'Configuration',
  async execute(message, args) {
    try {
      const member = await message.guild.members.fetch(message.author.id);
      if (!welcome.canConfigure(member, message.guild)) throw new Error('Configuration réservée aux administrateurs et Sys+.');
      const sub = args[0]?.toLowerCase();
      if (sub === 'test') {
        await welcome.testMessage(member);
        return message.reply({ embeds: [E.success('Message de test envoyé. Aucun rôle n’a été attribué.')] });
      }
      const settings = welcome.getSettings(message.guild.id);
      if (sub === 'on' || sub === 'off') {
        settings.enabled = sub === 'on';
        welcome.saveSettings(settings);
      } else if (sub && sub !== 'setup') throw new Error('Utilise `&welcome setup`, `&welcome test`, `&welcome on` ou `&welcome off`.');
      return await message.reply(welcome.buildEditor(settings, message.author.id));
    } catch (err) {
      return message.reply({ embeds: [E.error(err.code ? 'Discord a refusé l’action. Vérifie les permissions du bot.' : err.message)], allowedMentions: { parse: [] } });
    }
  },
};
