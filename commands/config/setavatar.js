const { executeProfile } = require('../../utils/bot-profile');
module.exports = {
  name: 'setavatar', aliases: ['setpp'], description: 'Modifier la photo de profil du bot',
  usage: '&setavatar <URL> ou &setavatar avec une image jointe', permission: 'Public', category: 'Configuration',
  execute(message, args, client) { return executeProfile(message, args, client, 'avatar'); },
};
