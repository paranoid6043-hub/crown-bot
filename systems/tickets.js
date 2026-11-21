const {
  EmbedBuilder, ActionRowBuilder, ButtonStyle, ChannelType, PermissionFlagsBits: P,
  MessageFlags, AttachmentBuilder,
} = require('discord.js');
const { db } = require('../database');
const { hasPermission } = require('../utils/permissions');
const panel = require('../utils/ticket-panel');
const locks = new Set();
const deferredEditors = new WeakSet();
const PRIVATE = MessageFlags.Ephemeral;

function isAdmin(member, guild) {
  return member.id === guild.ownerId || member.permissions.has(P.Administrator)
    || hasPermission(member.id, guild, 'Sys+');
}
function isStaff(member, guild, cfg) {
  return isAdmin(member, guild) || Boolean(cfg.staff_role_id && member.roles.cache.has(cfg.staff_role_id));
}
function getTicket(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}
function updateTicket(channelId, fields) {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE tickets SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE channel_id = ?`)
    .run(...keys.map(k => fields[k]), channelId);
}
function controls(closed = false) {
  return new ActionRowBuilder().addComponents(...(closed ? [
    panel.button('ticket_transcript', 'Transcription', '📄'),
    panel.button('ticket_reopen', 'Rouvrir', '🔓', ButtonStyle.Success),
    panel.button('ticket_delete', 'Supprimer', '🗑️', ButtonStyle.Danger),
  ] : [
    panel.button('ticket_claim', 'Prendre en charge', '🙋', ButtonStyle.Primary),
    panel.button('ticket_transcript', 'Transcription', '📄'),
    panel.button('ticket_close', 'Fermer', '🔒', ButtonStyle.Danger),
  ]));
}
async function refreshControls(channel, ticket) {
  if (!ticket.control_message_id) return;
  try {
    const message = await channel.messages.fetch(ticket.control_message_id);
    await message.edit({ components: [controls(ticket.status === 'closed')] });
  } catch (err) { console.error('Boutons du ticket :', err.message); }
}
async function createTranscript(channel, ticket) {
  const lines = [];
  let before;
  let bytes = 0;
  let truncated = false;
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    const messages = [...batch.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    for (const msg of messages) {
      const embeds = msg.embeds.map(e => [e.title, e.description, ...(e.fields || []).map(f => `${f.name}: ${f.value}`)].filter(Boolean).join('\n'));
      const entry = `[${new Date(msg.createdTimestamp).toISOString()}] ${msg.author?.tag || 'Inconnu'} (${msg.author?.id || '?'})\n`
        + [msg.content, ...embeds, ...msg.attachments.map(a => a.url)].filter(Boolean).join('\n') + '\n';
      bytes += Buffer.byteLength(entry);
      if (bytes > 7_000_000) { truncated = true; break; }
      lines.push(entry);
    }
    if (truncated || batch.size < 100) break;
    before = messages[messages.length - 1].id;
  }
  const header = `CROWN BOT — TRANSCRIPTION\nSalon : ${channel.name} (${channel.id})\nAuteur : ${ticket.user_id}\nSujet : ${ticket.topic || 'Support'}\n`
    + (truncated ? 'ATTENTION : historique partiel, seuls les messages récents sont inclus.\n' : '') + '\n';
  return new AttachmentBuilder(Buffer.from(header + lines.reverse().join('\n'), 'utf8'), { name: `ticket-${channel.id}.txt` });
}

async function handleTicketCommand(message, action, args = []) {
  const { guild, channel, author } = message;
  const ticket = getTicket(channel.id);
  if (!ticket || ticket.guild_id !== guild.id || !['open', 'closed'].includes(ticket.status)) {
    throw new Error('Cette commande s’utilise uniquement dans un ticket.');
  }
  const cfg = panel.getConfig(guild.id);
  const member = guild.members.cache.get(author.id) || await guild.members.fetch(author.id);
  const staff = isStaff(member, guild, cfg) || Boolean(ticket.staff_role_id && member.roles.cache.has(ticket.staff_role_id));
  if (author.id !== ticket.user_id && !staff) throw new Error('Seuls l’auteur du ticket et le support peuvent utiliser cette commande.');
  const key = `channel:${channel.id}`;
  if (locks.has(key)) throw new Error('Une action est déjà en cours sur ce ticket.');
  locks.add(key);
  try {
    if (action === 'rename') {
      const name = args.join(' ').trim().toLowerCase().replace(/\s+/g, '-');
      if (!name) throw new Error('Indique le nouveau nom : &rename recrutement-paul');
      if (name.length > 100) throw new Error('Le nom du salon doit contenir au maximum 100 caractères.');
      await channel.setName(name, `Ticket renommé par ${author.tag || author.id}`);
      return message.reply({ content: `✅ Ticket renommé : **${name}**.`, allowedMentions: { parse: [] } });
    }
    if (action !== 'close') throw new Error('Commande de ticket inconnue.');
    if (cfg.logs_channel_id) {
      // Keep configured transcripts before the channel disappears. On failure, keep the ticket intact.
      try {
        const logs = await guild.channels.fetch(cfg.logs_channel_id);
        if (logs?.type !== ChannelType.GuildText || logs.id === channel.id
          || logs.permissionsFor(guild.roles.everyone).has(P.ViewChannel)) throw new Error('Salon d’archives privé invalide');
        await logs.send({ content: `📁 Ticket de <@${ticket.user_id}> fermé et supprimé par <@${author.id}> • ${channel.name} (${channel.id})`,
          files: [await createTranscript(channel, ticket)], allowedMentions: { parse: [] } });
      } catch (err) {
        console.error('Archivage avant suppression :', err.message);
        throw new Error('Impossible de sauvegarder la transcription dans les logs. Le ticket est conservé ; vérifie le salon d’archives et les permissions du bot.');
      }
    }
    await channel.delete(`Ticket fermé et supprimé par ${author.tag || author.id}`);
    updateTicket(channel.id, { status: 'deleted', closed_at: new Date().toISOString(), closed_by: author.id });
  } finally { locks.delete(key); }
}

async function openTicket(interaction, cfg, topic) {
  const key = `open:${interaction.guildId}:${interaction.user.id}`;
  if (locks.has(key)) throw new Error('La création de ton ticket est déjà en cours.');
  locks.add(key);
  let channel;
  let committed = false;
  try {
    await interaction.deferReply({ flags: PRIVATE });
    const { guild, user } = interaction;
    const existing = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = ?').get(guild.id, user.id, 'open');
    if (existing) {
      let oldChannel;
      try { oldChannel = await guild.channels.fetch(existing.channel_id); }
      catch (err) { if (err.code !== 10003) throw err; }
      if (oldChannel) return interaction.editReply({ content: `Tu as déjà un ticket ouvert : <#${existing.channel_id}>.` });
      updateTicket(existing.channel_id, { status: 'deleted' });
    }
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(P.ManageChannels)) throw new Error('Le bot a besoin de la permission Gérer les salons.');
    const categoryId = cfg.topic_categories?.[topic.id] || cfg.category_id;
    if (categoryId) {
      const category = await guild.channels.fetch(categoryId);
      if (category?.type !== ChannelType.GuildCategory) throw new Error('La catégorie de tickets n’existe plus. Contacte un administrateur.');
    }
    if (cfg.staff_role_id && !await guild.roles.fetch(cfg.staff_role_id)) throw new Error('Le rôle support n’existe plus. Contacte un administrateur.');
    const access = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];
    const overwrites = [
      { id: guild.id, deny: [P.ViewChannel, P.CreatePublicThreads, P.CreatePrivateThreads, P.SendMessagesInThreads] },
      { id: user.id, allow: access },
      { id: me.id, allow: [...access, P.ManageChannels] },
    ];
    if (cfg.staff_role_id) overwrites.push({ id: cfg.staff_role_id, allow: access });
    const name = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 25) || 'membre';
    channel = await guild.channels.create({
      name: `ticket-${name}-${Date.now().toString().slice(-6)}`, type: ChannelType.GuildText,
      parent: categoryId || undefined, permissionOverwrites: overwrites,
      topic: `Ticket de ${user.id} • ${topic.label}`.slice(0, 1024), reason: `Ticket demandé par ${user.tag}`,
    });
    const embed = new EmbedBuilder().setColor(cfg.color).setTitle(`${topic.emoji || '🎫'} ${topic.label}`)
      .setDescription(`Bienvenue <@${user.id}> !\nExplique directement ta demande dans ce salon.\nL’équipe te répondra ici. Merci de patienter sans multiplier les mentions.`)
      .setFooter({ text: cfg.footer || 'Support' }).setTimestamp();
    const welcome = await channel.send({
      content: `<@${user.id}>${cfg.staff_role_id ? ` • <@&${cfg.staff_role_id}>` : ''}`,
      embeds: [embed], components: [controls()],
      allowedMentions: { users: [user.id], roles: cfg.staff_role_id ? [cfg.staff_role_id] : [] },
    });
    db.prepare('INSERT INTO tickets (guild_id, user_id, channel_id, status, created_at, topic, control_message_id, staff_role_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(guild.id, user.id, channel.id, 'open', new Date().toISOString(), topic.label, welcome.id, cfg.staff_role_id || null);
    committed = true;
    return await interaction.editReply({ content: `🎫 Ton ticket est prêt : <#${channel.id}>.` });
  } catch (err) {
    if (channel && !committed) await channel.delete('Création du ticket incomplète').catch(cleanup => console.error('Nettoyage ticket :', cleanup.message));
    throw err;
  } finally { locks.delete(key); }
}
async function handleInteraction(interaction) {
  if (!interaction.guild) return interaction.reply({ content: 'Utilise ces boutons dans un serveur.', flags: PRIVATE });
  const { guild, user, customId } = interaction;
  const cfg = panel.getConfig(guild.id);
  const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id);
  if (/^ticket_(edit_|save_|settings_|routes:|route_|publish:)/.test(customId)) {
    const [action, ownerId] = customId.split(':');
    if (ownerId !== user.id || !isAdmin(member, guild)) throw new Error('Cet éditeur est réservé à son administrateur. Utilise &ticket config.');
    if (action === 'ticket_routes') return interaction.reply({ ...panel.buildRoutes(cfg, user.id), flags: PRIVATE });
    if (action === 'ticket_route_back') return interaction.update(panel.buildEditor(cfg, guild, user.id));
    if (action === 'ticket_route_topic') return interaction.update(panel.buildRoutes(cfg, user.id, interaction.values[0]));
    if (action === 'ticket_route_category') {
      await interaction.deferUpdate();
      deferredEditors.add(interaction);
      const topicId = customId.split(':')[2];
      if (!cfg.topics.some(t => t.id === topicId)) throw new Error('Ce type de ticket a été supprimé. Rouvre Catégories par type.');
      const categoryId = interaction.values[0] || null;
      if (categoryId) {
        const category = await guild.channels.fetch(categoryId);
        if (category?.type !== ChannelType.GuildCategory) throw new Error('Choisis une catégorie du serveur.');
        const me = await guild.members.fetchMe();
        if (!category.permissionsFor(me)?.has([P.ViewChannel, P.ManageChannels])) throw new Error('Le bot doit pouvoir voir cette catégorie et y gérer les salons.');
      }
      cfg.topic_categories = { ...cfg.topic_categories };
      if (categoryId) cfg.topic_categories[topicId] = categoryId;
      else delete cfg.topic_categories[topicId];
      panel.saveConfig(cfg);
      return interaction.editReply(panel.buildRoutes(cfg, user.id, topicId));
    }
    if (action.startsWith('ticket_settings_')) {
      await interaction.deferUpdate();
      deferredEditors.add(interaction);
      const setting = action.slice('ticket_settings_'.length);
      const selectedId = interaction.values[0] || null;
      if (!['category', 'channel', 'role'].includes(setting)) throw new Error('Réglage de tickets inconnu.');
      if (setting === 'role') {
        if (selectedId) {
          const role = await guild.roles.fetch(selectedId);
          if (!role || role.id === guild.id || role.managed) throw new Error('Choisis un rôle support différent de @everyone et des rôles de bots.');
        }
        cfg.staff_role_id = selectedId;
      } else {
        if (!selectedId && setting === 'channel') throw new Error('Choisis un salon pour publier le panneau.');
        if (selectedId) {
          const selected = await guild.channels.fetch(selectedId);
          const expectedType = setting === 'category' ? ChannelType.GuildCategory : ChannelType.GuildText;
          if (!selected || selected.type !== expectedType) throw new Error('Choisis un salon ou une catégorie du type demandé.');
          const me = await guild.members.fetchMe();
          const required = setting === 'category' ? [P.ViewChannel, P.ManageChannels]
            : [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory];
          if (!selected.permissionsFor(me)?.has(required)) throw new Error(setting === 'category'
            ? 'Le bot doit pouvoir voir cette catégorie et y gérer les salons.'
            : 'Le bot doit pouvoir voir ce salon, y envoyer des messages, intégrer des liens et lire l’historique.');
        }
        if (setting === 'channel' && cfg.channel_id !== selectedId) cfg.message_id = null;
        cfg[setting === 'category' ? 'category_id' : 'channel_id'] = selectedId;
      }
      panel.saveConfig(cfg);
      return interaction.editReply(panel.buildEditor(cfg, guild, user.id));
    }
    if (action.startsWith('ticket_edit_')) return interaction.showModal(panel.editorModal(action.slice(12), cfg, user.id));
    if (action.startsWith('ticket_save_')) {
      const next = panel.applyEditor(cfg, action.slice(12), interaction.fields);
      const preview = panel.buildPanel(next, guild);
      preview.embeds.forEach(e => e.toJSON());
      preview.components.forEach(c => c.toJSON());
      panel.saveConfig(next);
      if (interaction.isFromMessage()) return interaction.update(panel.buildEditor(next, guild, user.id));
      return interaction.reply({ ...panel.buildEditor(next, guild, user.id), flags: PRIVATE });
    }
    await interaction.deferReply({ flags: PRIVATE });
    const message = await panel.publishPanel(cfg, guild);
    return interaction.editReply({ content: `✅ Panneau publié : ${message.url}` });
  }
  if (customId === 'ticket_select' || customId === 'ticket_open') {
    if (!cfg.message_id) throw new Error('Le système de tickets n’est pas encore configuré.');
    if (customId === 'ticket_select' && interaction.message.id !== cfg.message_id) throw new Error('Ce panneau a été remplacé. Utilise le panneau actuel.');
    const topics = cfg.published_topics || cfg.topics;
    const topic = customId === 'ticket_open' ? topics[0] : topics.find(t => t.id === interaction.values[0]);
    if (!topic) throw new Error('Ce choix a changé. Sélectionne de nouveau le sujet sur le panneau actualisé.');
    return openTicket(interaction, cfg, topic);
  }
  if (customId.startsWith('ticket_create:')) {
    const topic = (cfg.published_topics || cfg.topics).find(t => t.id === customId.split(':')[1]);
    if (!topic) throw new Error('Les sujets ont changé. Ouvre à nouveau le menu de tickets.');
    return openTicket(interaction, cfg, topic);
  }
  const ticket = getTicket(interaction.channelId);
  if (!ticket || !['open', 'closed'].includes(ticket.status)) throw new Error('Ce salon n’est pas un ticket actif.');
  const staff = isStaff(member, guild, cfg) || Boolean(ticket.staff_role_id && member.roles.cache.has(ticket.staff_role_id));
  if (!staff && user.id !== ticket.user_id) throw new Error('Seuls l’auteur du ticket et le support peuvent utiliser ces boutons.');
  if (customId === 'ticket_close' || customId === 'ticket_delete') {
    if (customId === 'ticket_delete' && (!staff || ticket.status !== 'closed')) throw new Error('Seul le support peut supprimer un ticket fermé.');
    if (customId === 'ticket_close' && ticket.status !== 'open') throw new Error('Ce ticket est déjà fermé.');
    const deleting = customId === 'ticket_delete';
    return interaction.reply({
      content: deleting ? 'Supprimer définitivement ce salon ? Télécharge la transcription avant de confirmer.' : 'Fermer ce ticket ? Le salon restera accessible pour consulter la conversation.',
      flags: PRIVATE, components: [new ActionRowBuilder().addComponents(
        panel.button(`ticket_confirm_${deleting ? 'delete' : 'close'}:${user.id}`, 'Confirmer', '✅', ButtonStyle.Danger),
        panel.button(`ticket_cancel:${user.id}`, 'Annuler', '↩️'),
      )],
    });
  }
  if (customId.startsWith('ticket_cancel:')) {
    if (customId.split(':')[1] !== user.id) throw new Error('Cette confirmation ne t’appartient pas.');
    return interaction.update({ content: 'Action annulée.', components: [] });
  }
  if (customId === 'ticket_transcript') {
    await interaction.deferReply({ flags: PRIVATE });
    return interaction.editReply({ files: [await createTranscript(interaction.channel, ticket)] });
  }
  if (customId.startsWith('ticket_confirm_') && customId.split(':')[1] !== user.id) throw new Error('Cette confirmation ne t’appartient pas.');
  const key = `channel:${interaction.channelId}`;
  if (locks.has(key)) throw new Error('Une action est déjà en cours sur ce ticket.');
  locks.add(key);
  try {
    await interaction.deferReply({ flags: PRIVATE });
    const channel = interaction.channel;
    if (customId === 'ticket_claim') {
      if (!staff || ticket.status !== 'open') throw new Error('Seul le support peut prendre en charge un ticket ouvert.');
      if (ticket.claimed_by) throw new Error(`Ce ticket est déjà pris en charge par <@${ticket.claimed_by}>.`);
      await channel.send({ embeds: [new EmbedBuilder().setColor(cfg.color).setDescription(`🙋 <@${user.id}> prend en charge ce ticket.`)], allowedMentions: { parse: [] } });
      updateTicket(channel.id, { claimed_by: user.id });
      return interaction.editReply({ content: '✅ Tu as pris en charge ce ticket.' });
    }
    if (customId.startsWith('ticket_confirm_close:') || customId === 'ticket_reopen') {
      const closing = customId.startsWith('ticket_confirm_close:');
      if (!closing && !staff) throw new Error('Seul le support peut rouvrir un ticket.');
      if (ticket.status !== (closing ? 'open' : 'closed')) throw new Error('Le statut du ticket a déjà changé.');
      const ownerKey = `open:${guild.id}:${ticket.user_id}`;
      if (!closing) {
        if (locks.has(ownerKey)) throw new Error('Un ticket est en cours de création pour ce membre.');
        const existing = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = ?').get(guild.id, ticket.user_id, 'open');
        if (existing) throw new Error(`Ce membre a déjà un ticket ouvert : <#${existing.channel_id}>.`);
        locks.add(ownerKey);
      }
      try {
      const overwrites = channel.permissionOverwrites.cache.map(overwrite => {
        if (overwrite.type !== 1 || overwrite.id === guild.members.me.id) return overwrite;
        return { id: overwrite.id, type: overwrite.type,
          allow: closing ? overwrite.allow.remove(P.SendMessages) : overwrite.allow.add(P.SendMessages),
          deny: closing ? overwrite.deny.add(P.SendMessages) : overwrite.deny.remove(P.SendMessages) };
      });
      await channel.permissionOverwrites.set(overwrites);
      updateTicket(channel.id, { status: closing ? 'closed' : 'open', closed_at: closing ? new Date().toISOString() : null });
      await refreshControls(channel, { ...ticket, status: closing ? 'closed' : 'open' });
      await channel.send({ embeds: [new EmbedBuilder().setColor(closing ? 0xED4245 : 0x57F287)
        .setDescription(`${closing ? '🔒 Ticket fermé' : '🔓 Ticket rouvert'} par <@${user.id}>.`)],
        components: [controls(closing)], allowedMentions: { parse: [] } });
      let logWarning = '';
      if (closing && cfg.logs_channel_id) {
        try {
          const logs = await guild.channels.fetch(cfg.logs_channel_id);
          if (logs?.type !== ChannelType.GuildText) throw new Error('Salon de logs introuvable');
          if (logs.permissionsFor(guild.roles.everyone).has(P.ViewChannel)) throw new Error('Le salon de logs doit être privé');
          await logs.send({ content: `📁 Ticket de <@${ticket.user_id}> fermé par <@${user.id}> • <#${channel.id}>`,
            files: [await createTranscript(channel, ticket)], allowedMentions: { parse: [] } });
        } catch (err) {
          console.error('Archivage du ticket :', err.message);
          logWarning = '\n⚠️ Échec de l’envoi aux logs. Télécharge la transcription avant de supprimer le salon.';
        }
      }
      return interaction.editReply({ content: `${closing ? '🔒 Ticket fermé.' : '🔓 Ticket rouvert.'}${logWarning}`, components: [] });
      } finally { if (!closing) locks.delete(ownerKey); }
    }
    if (customId.startsWith('ticket_confirm_delete:')) {
      if (!staff || ticket.status !== 'closed') throw new Error('Seul le support peut supprimer un ticket fermé.');
      await channel.delete(`Suppression du ticket par ${user.tag}`);
      updateTicket(channel.id, { status: 'deleted' });
      return;
    }
    throw new Error('Action de ticket inconnue.');
  } finally { locks.delete(key); }
}
async function handleTicketInteraction(interaction) {
  try { await handleInteraction(interaction); }
  catch (err) {
    console.error('Tickets :', err.message);
    const content = err.code ? 'Discord a refusé l’action. Vérifie les permissions du bot et la configuration des tickets.' : err.message;
    const payload = { content, allowedMentions: { parse: [] } };
    if (deferredEditors.has(interaction)) await interaction.followUp({ ...payload, flags: PRIVATE }).catch(() => {});
    else if (interaction.deferred) await interaction.editReply(payload).catch(() => {});
    else if (interaction.replied) await interaction.followUp({ ...payload, flags: PRIVATE }).catch(() => {});
    else await interaction.reply({ ...payload, flags: PRIVATE }).catch(() => {});
  }
}
module.exports = { handleTicketInteraction, handleTicketButton: handleTicketInteraction, handleTicketCommand, isAdmin, isStaff, getTicket, createTranscript, controls };
