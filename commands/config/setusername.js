const { executeProfile } = require('../../utils/bot-profile');
module.exports = {
  name: 'setusername', aliases: ['setglobalname'], description: 'Modifier le nom global du compte du bot',
  usage: '&setusername <nouveau nom>', permission: 'Public', category: 'Configuration',
  execute(message, args, client) { return executeProfile(message, args, client, 'name'); },
};
