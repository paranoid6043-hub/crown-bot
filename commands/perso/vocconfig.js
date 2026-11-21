const { ChannelType } = require('discord.js');
const { parseChannel } = require('../../utils/parsers');
const E = require('../../utils/embeds');
const { db } = require('../../database');

const setConfig = db.prepare(`
  INSERT INTO vocaux_perso_config (guild_id, category_id, create_channel_id)
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET category_id = excluded.category_id, create_channel_id = excluded.create_channel_id
`);
const getConfig = db.prepare('SELECT * FROM vocaux_perso_config WHERE guild_id = ?');

module.exports = {
  name: 'vocconfig',
  aliases: ['configvoc'],
  description: 'Panel de configuration des vocaux perso',
  usage: '&vocconfig <categorie_id> <salon_creation_id>',
  permission: 'Sys+',
  category: 'Vocaux perso',

  async execute(message, args) {
    if (args.length < 2) {
      const conf = getConfig.get(message.guild.id);
      if (!conf) return message.reply({ embeds: [E.info('Vocaux perso non configures.\n`&vocconfig <categorie_id> <salon_creation_id>`')] });

      const cat = message.guild.channels.cache.get(conf.category_id);
      const ch = message.guild.channels.cache.get(conf.create_channel_id);
      return message.reply({ embeds: [
        E.embed()
          .setTitle('🎧 Config vocaux perso')
          .addFields(
            { name: 'Categorie', value: cat ? cat.name : 'Introuvable', inline: true },
            { name: 'Salon de creation', value: ch ? ch.name : 'Introuvable', inline: true },
          ),
      ] });
    }

    const categoryId = args[0];
    const createChannelId = args[1];

    const category = message.guild.channels.cache.get(categoryId);
    const createChannel = message.guild.channels.cache.get(createChannelId);

    if (!category || category.type !== ChannelType.GuildCategory) {
      return message.reply({ embeds: [E.error('Categorie invalide.')] });
    }
    if (!createChannel || !createChannel.isVoiceBased()) {
      return message.reply({ embeds: [E.error('Salon de creation invalide (doit etre un vocal).')] });
    }

    setConfig.run(message.guild.id, categoryId, createChannelId);
    return message.reply({ embeds: [E.success(`Vocaux perso configures.\nCategorie: **${category.name}**\nSalon de creation: **${createChannel.name}**`)] });
  },
};
