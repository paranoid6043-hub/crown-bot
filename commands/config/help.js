const { openHelp } = require('../../utils/help-menu');
module.exports = {
  name: 'help', aliases: ['aide', 'commands', 'commandes'],
  description: 'Centre d’aide : catégories, recherche et fiches détaillées',
  usage: '&help [commande, catégorie ou mot-clé]', permission: 'Public', category: 'Utilitaire',
  execute(message, args, client) { return openHelp(message, args, client); },
};
