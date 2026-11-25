const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  name: 'antiraid',
  description: 'Configure le systeme anti-raid',
  usage: '&antiraid [max|off|status]',
  permission: 'Sys+',
  category: 'Anti-Raid',

  async execute(message, args) {
    const action = args[0]?.toLowerCase();

    if (action === 'max') {
      db.prepare(`INSERT INTO antiraid_config (guild_id, antispam, antispam_limit, antispam_time, antispam_action, antispam_duration, antilink, antilink_action, antilink_duration, antimention, antimention_limit, antimention_action, antimention_duration, anticaps, anticaps_ratio, antiemoji, antiemoji_limit, antijoin, antijoin_limit, antijoin_time)
        VALUES (?, 1, 5, 5, 'timeout', 10, 1, 'timeout', 5, 1, 4, 'timeout', 10, 1, 0.7, 1, 8, 1, 5, 10)
        ON CONFLICT (guild_id) DO UPDATE SET
          antispam = 1, antispam_limit = 5, antispam_time = 5, antispam_action = 'timeout', antispam_duration = 10,
          antilink = 1, antilink_action = 'timeout', antilink_duration = 5,
          antimention = 1, antimention_limit = 4, antimention_action = 'timeout', antimention_duration = 10,
          anticaps = 1, anticaps_ratio = 0.7,
          antiemoji = 1, antiemoji_limit = 8,
          antijoin = 1, antijoin_limit = 5, antijoin_time = 10
      `).run(message.guild.id);

      const e = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle('🛡️ Anti-Raid — Mode MAX activé')
        .setDescription('Toutes les protections sont maintenant **actives** avec des paramètres stricts.')
        .addFields(
          { name: '🔇 Antispam', value: '`5 msgs / 5s` → timeout 10min', inline: true },
          { name: '🔗 Antilink', value: '`Suppression` → timeout 5min', inline: true },
          { name: '📢 Anti-mention', value: '`4+ mentions` → timeout 10min', inline: true },
          { name: '🔠 Anti-majuscules', value: '`70%+ caps` → suppression', inline: true },
          { name: '😀 Anti-emoji', value: '`8+ emojis` → suppression', inline: true },
          { name: '🚪 Anti-mass join', value: '`5 joins / 10s` → kick', inline: true },
        )
        .setFooter({ text: 'Utilisez &antiraid off pour tout désactiver' });

      return message.reply({ embeds: [e] });
    }

    if (action === 'off') {
      db.prepare(`INSERT INTO antiraid_config (guild_id, antispam, antilink, antimention, anticaps, antiemoji, antijoin)
        VALUES (?, 0, 0, 0, 0, 0, 0)
        ON CONFLICT (guild_id) DO UPDATE SET
          antispam = 0, antilink = 0, antimention = 0, anticaps = 0, antiemoji = 0, antijoin = 0
      `).run(message.guild.id);

      const e = new EmbedBuilder()
        .setColor(config.errorColor)
        .setTitle('🛡️ Anti-Raid — Désactivé')
        .setDescription('Toutes les protections anti-raid ont été **désactivées**.')
        .setFooter({ text: 'Utilisez &antiraid max pour tout réactiver' });

      return message.reply({ embeds: [e] });
    }

    const cfg = db.prepare('SELECT * FROM antiraid_config WHERE guild_id = ?').get(message.guild.id);

    const status = (active, label) => active ? `\`✅\` ${label}` : `\`❌\` Inactif`;

    const e = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle('🛡️ Configuration Anti-Raid')
      .setDescription(cfg ? '' : '⚠️ Aucune configuration. Utilisez `&antiraid max` pour activer toutes les protections.')
      .addFields(
        {
          name: '🔇 Antispam',
          value: cfg?.antispam
            ? `\`✅\` ${cfg.antispam_limit || 5} msgs / ${cfg.antispam_time || 5}s → ${cfg.antispam_action || 'timeout'} ${cfg.antispam_duration || 5}min`
            : '`❌` Inactif',
          inline: true,
        },
        {
          name: '🔗 Antilink',
          value: cfg?.antilink
            ? `\`✅\` Action: ${cfg.antilink_action || 'delete'}`
            : '`❌` Inactif',
          inline: true,
        },
        {
          name: '📢 Anti-mention',
          value: cfg?.antimention
            ? `\`✅\` ${cfg.antimention_limit || 5}+ mentions → ${cfg.antimention_action || 'timeout'}`
            : '`❌` Inactif',
          inline: true,
        },
        {
          name: '🔠 Anti-majuscules',
          value: cfg?.anticaps
            ? `\`✅\` ${Math.round((cfg.anticaps_ratio || 0.7) * 100)}%+ → suppression`
            : '`❌` Inactif',
          inline: true,
        },
        {
          name: '😀 Anti-emoji',
          value: cfg?.antiemoji
            ? `\`✅\` ${cfg.antiemoji_limit || 10}+ emojis → suppression`
            : '`❌` Inactif',
          inline: true,
        },
        {
          name: '🚪 Anti-mass join',
          value: cfg?.antijoin
            ? `\`✅\` ${cfg.antijoin_limit || 5} joins / ${cfg.antijoin_time || 10}s → kick`
            : '`❌` Inactif',
          inline: true,
        },
      )
      .setFooter({ text: '&antiraid max | &antiraid off | &antispam | &antilink | &antimention | &anticaps | &antiemoji | &antijoin' });

    const wlChannels = db.prepare('SELECT * FROM antiraid_whitelist WHERE guild_id = ? AND type = ?').all(message.guild.id, 'channel');
    const wlRoles = db.prepare('SELECT * FROM antiraid_whitelist WHERE guild_id = ? AND type = ?').all(message.guild.id, 'role');

    if (wlChannels.length || wlRoles.length) {
      let wlText = '';
      if (wlChannels.length) wlText += `**Salons:** ${wlChannels.map(w => `<#${w.target_id}>`).join(', ')}\n`;
      if (wlRoles.length) wlText += `**Rôles:** ${wlRoles.map(w => `<@&${w.target_id}>`).join(', ')}`;
      e.addFields({ name: '📋 Whitelist', value: wlText });
    }

    return message.reply({ embeds: [e] });
  },
};
