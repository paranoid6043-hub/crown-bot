const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const E = require('../../utils/embeds');
const { parseChannel, parseUser } = require('../../utils/parsers');
const panel = require('../../utils/ticket-panel');
const tickets = require('../../systems/tickets');

module.exports = {
  name: 'ticket', description: 'Tickets privés et panneau personnalisable',
  usage: '&ticket setup [#salon] [ID-catégorie] [@support] | config | role @support | logs #salon | category ID | close | rename <nom> | add/remove @membre',
  permission: 'Public', category: 'Tickets',
  async execute(message, args) {
    const sub = args[0]?.toLowerCase();
    const guild = message.guild;
    const cfg = panel.getConfig(guild.id);
    const member = await guild.members.fetch(message.author.id);
    const admin = tickets.isAdmin(member, guild);
    const staff = tickets.isStaff(member, guild, cfg);
    if (['setup', 'config', 'role', 'logs', 'category'].includes(sub) && !admin) {
      return message.reply({ embeds: [E.error('Configuration réservée aux administrateurs et Sys+.')] });
    }
    try {
      if (sub === 'close' || sub === 'rename') return await tickets.handleTicketCommand(message, sub, args.slice(1));
      if (sub === 'setup') {
        const channelId = args[1] ? parseChannel(args[1]) : message.channel.id;
        if (!channelId) throw new Error('Mentionne un salon texte valide.');
        const channel = await guild.channels.fetch(channelId);
        if (channel?.type !== ChannelType.GuildText) throw new Error('Le panneau doit être envoyé dans un salon texte.');
        if (args[2]) {
          const categoryId = parseChannel(args[2]);
          if (!categoryId || (await guild.channels.fetch(categoryId))?.type !== ChannelType.GuildCategory) throw new Error('Indique l’identifiant d’une catégorie valide.');
          cfg.category_id = categoryId;
        }
        if (args[3]) {
          const roleId = args[3].replace(/[<@&>]/g, '');
          const role = /^\d{17,20}$/.test(roleId) ? await guild.roles.fetch(roleId) : null;
          if (!role || role.id === guild.id || role.managed) throw new Error('Choisis un rôle support valide, différent de @everyone et des rôles de bots.');
          cfg.staff_role_id = role.id;
        }
        if (cfg.channel_id !== channel.id) cfg.message_id = null;
        cfg.channel_id = channel.id;
        const editor = panel.buildEditor(cfg, guild, message.author.id);
        await message.reply(editor);
        panel.saveConfig(cfg);
        return;
      }
      if (sub === 'config') return message.reply(panel.buildEditor(cfg, guild, message.author.id));
      if (['role', 'logs', 'category'].includes(sub)) {
        if (!args[1]) throw new Error(`Indique une valeur pour &ticket ${sub}, ou off pour désactiver.`);
        const field = { role: 'staff_role_id', logs: 'logs_channel_id', category: 'category_id' }[sub];
        let id = null;
        if (args[1].toLowerCase() !== 'off') {
          id = args[1].replace(/[<#@&>]/g, '');
          if (!/^\d{17,20}$/.test(id)) throw new Error('Identifiant ou mention invalide.');
          if (sub === 'role') {
            const role = await guild.roles.fetch(id);
            if (!role || role.id === guild.id || role.managed) throw new Error('Choisis un rôle support valide, différent de @everyone et des rôles de bots.');
          } else {
            const channel = await guild.channels.fetch(id);
            if (channel?.type !== (sub === 'category' ? ChannelType.GuildCategory : ChannelType.GuildText)) throw new Error('Le salon ou la catégorie ne correspond pas au type attendu.');
            if (sub === 'logs' && channel.permissionsFor(guild.roles.everyone).has(P.ViewChannel)) throw new Error('Choisis un salon de logs privé : les transcriptions contiennent les conversations des tickets.');
          }
        }
        cfg[field] = id;
        panel.saveConfig(cfg);
        return message.reply({ embeds: [E.success('Configuration enregistrée. Les réglages de rôle et de catégorie s’appliquent aux prochains tickets.')] });
      }
      if (['add', 'remove'].includes(sub)) {
        const ticket = tickets.getTicket(message.channel.id);
        if (!ticket || ticket.status !== 'open') throw new Error('Cette commande s’utilise dans un ticket ouvert.');
        const ticketStaff = staff || Boolean(ticket.staff_role_id && member.roles.cache.has(ticket.staff_role_id));
        if (!ticketStaff) throw new Error('Seul le support peut ajouter ou retirer des participants.');
        const userId = parseUser(args[1]);
        if (!userId) throw new Error('Mentionne un membre valide.');
        const target = await guild.members.fetch(userId);
        if (target.id === ticket.user_id || target.id === guild.members.me.id || tickets.isStaff(target, guild, cfg)
          || (ticket.staff_role_id && target.roles.cache.has(ticket.staff_role_id))) throw new Error('L’auteur, le bot et le support ne peuvent pas être modifiés ici.');
        await message.channel.permissionOverwrites.edit(userId, {
          ViewChannel: sub === 'add', SendMessages: sub === 'add', ReadMessageHistory: sub === 'add', AttachFiles: sub === 'add',
        });
        return message.reply({ embeds: [E.success(`<@${userId}> ${sub === 'add' ? 'ajouté au' : 'retiré du'} ticket.`)], allowedMentions: { parse: [] } });
      }
      return message.reply({ embeds: [E.info([
        '**🎫 Tickets — Crown Bot**',
        '`&ticket setup [#salon]` — Ouvrir le menu de configuration',
        '`&ticket config` — Modifier le texte, la couleur, la bannière et les choix',
        '`&ticket role @support` — Définir l’équipe support',
        '`&ticket category ID` — Catégorie des nouveaux tickets',
        '`&ticket logs #salon-privé` — Archiver les conversations à la fermeture',
        '`&close` — Fermer et supprimer immédiatement le ticket',
        '`&rename nouveau-nom` — Renommer le salon du ticket',
        '`&ticket add @membre` / `&ticket remove @membre` — Participants (support)',
        'Les réglages `role`, `category` et `logs` acceptent `off`.',
      ].join('\n'))] });
    } catch (err) {
      console.error('Commande ticket :', err.message);
      return message.reply({ embeds: [E.error(err.code ? 'Discord a refusé l’action. Vérifie les identifiants et les permissions du bot.' : err.message)], allowedMentions: { parse: [] } });
    }
  },
};
