const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType,
} = require('discord.js');
const { db } = require('../database');
const { randomUUID } = require('crypto');

const DEFAULTS = {
  title: 'Ouvrir un ticket 📋⁉️',
  description: 'Besoin de nous contacter ?\nChoisis le sujet de ta demande dans le menu ci-dessous.\n\n**Tickets disponibles :**\n• Aide ⁉️\n• Recrutement 📋',
  footer: 'Crown Bot • À ton écoute',
  color: 0xA855F7,
  image: '',
  placeholder: 'Choisis le sujet de ton ticket…',
  topics: [
    { id: 'aide', label: 'Aide', emoji: '⁉️', description: 'Une question ou un problème ?' },
    { id: 'recrutement', label: 'Recrutement', emoji: '📋', description: 'Déposer une candidature pour rejoindre l’équipe' },
  ],
};

function getConfig(guildId) {
  const stored = db.prepare('SELECT * FROM tickets_config WHERE guild_id = ?').get(guildId);
  const cfg = { ...structuredClone(DEFAULTS), ...stored, guild_id: guildId };
  // Upgrade the original default in existing panels without changing custom menu choices.
  const legacy = cfg.topics.find(t => t.id === 'achat' && t.label === 'Acheter'
    && t.description === 'Une demande concernant un achat');
  if (legacy) {
    cfg.topics = cfg.topics.map(t => t === legacy ? { ...DEFAULTS.topics[1], id: t.id } : t);
    cfg.description = cfg.description.replace('• Achat 🛒', '• Recrutement 📋');
    if (cfg.title === 'Ouvrir un ticket 🛒⁉️') cfg.title = DEFAULTS.title;
  }
  return cfg;
}

function saveConfig(cfg) {
  const fields = ['guild_id', 'category_id', 'channel_id', 'message_id', 'staff_role_id', 'logs_channel_id',
    'title', 'description', 'footer', 'color', 'image', 'placeholder', 'topics', 'published_topics', 'topic_categories'];
  db.prepare(`INSERT OR REPLACE INTO tickets_config (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`)
    .run(...fields.map(key => cfg[key] ?? null));
}

function buildPanel(cfg, guild) {
  const embed = new EmbedBuilder().setColor(cfg.color).setTitle(cfg.title).setDescription(cfg.description);
  if (cfg.footer) {
    const iconURL = guild.iconURL?.();
    embed.setFooter({ text: cfg.footer, ...(iconURL ? { iconURL } : {}) });
  }
  if (cfg.image) embed.setImage(cfg.image);
  const menu = new StringSelectMenuBuilder().setCustomId('ticket_select')
    .setPlaceholder(cfg.placeholder).setMinValues(1).setMaxValues(1)
    .addOptions(cfg.topics.map(topic => ({
      label: topic.label, value: topic.id,
      ...(topic.description ? { description: topic.description } : {}),
      ...(topic.emoji ? { emoji: topic.emoji } : {}),
    })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], allowedMentions: { parse: [] } };
}

function button(id, label, emoji, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
}

function buildEditor(cfg, guild, userId) {
  const payload = buildPanel(cfg, guild);
  const category = new ChannelSelectMenuBuilder().setCustomId(`ticket_settings_category:${userId}`)
    .setPlaceholder('📁 Catégorie par défaut des tickets').setChannelTypes(ChannelType.GuildCategory)
    .setMinValues(0).setMaxValues(1);
  const destination = new ChannelSelectMenuBuilder().setCustomId(`ticket_settings_channel:${userId}`)
    .setPlaceholder('📨 Salon du panneau public').setChannelTypes(ChannelType.GuildText)
    .setMinValues(1).setMaxValues(1);
  const support = new RoleSelectMenuBuilder().setCustomId(`ticket_settings_role:${userId}`)
    .setPlaceholder('🛡️ Rôle de l’équipe support (facultatif)').setMinValues(0).setMaxValues(1);
  if (cfg.category_id) category.setDefaultChannels(cfg.category_id);
  if (cfg.channel_id) destination.setDefaultChannels(cfg.channel_id);
  if (cfg.staff_role_id) support.setDefaultRoles(cfg.staff_role_id);
  payload.components = [
    new ActionRowBuilder().addComponents(category),
    new ActionRowBuilder().addComponents(destination),
    new ActionRowBuilder().addComponents(support),
    new ActionRowBuilder().addComponents(
    button(`ticket_edit_text:${userId}`, 'Texte & couleur', '🎨'),
    button(`ticket_edit_topics:${userId}`, 'Choix du menu', '📋'),
    button(`ticket_edit_visual:${userId}`, 'Image & menu', '🖼️'),
    button(`ticket_routes:${userId}`, 'Catégories par type', '📂'),
    button(`ticket_publish:${userId}`, 'Publier / actualiser', '📨', ButtonStyle.Primary),
  )];
  payload.content = '**🎛️ Configuration des tickets — aperçu**\n'
    + 'Choisis la catégorie, le salon du panneau et le rôle support dans les menus.\n'
    + `Catégorie par défaut : ${cfg.category_id ? `<#${cfg.category_id}>` : 'aucune (salons à la racine du serveur)'}\n`
    + `Salon : ${cfg.channel_id ? `<#${cfg.channel_id}>` : 'à définir avec &ticket setup'} · `
    + `Staff : ${cfg.staff_role_id ? `<@&${cfg.staff_role_id}>` : 'administrateurs uniquement'}\n`
    + 'Personnalise ensuite le panneau et clique sur **Publier / actualiser**.\n'
    + 'Utilise **Catégories par type** pour séparer Aide, Recrutement et tes autres choix.\n'
    + 'La catégorie et le rôle sont enregistrés pour les prochains tickets. Efface leur sélection pour les désactiver.';
  return payload;
}

function input(id, label, value, maxLength, paragraph = false, required = true) {
  const field = new TextInputBuilder().setCustomId(id).setLabel(label).setMaxLength(maxLength)
    .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(required);
  if (value) field.setValue(value);
  return new ActionRowBuilder().addComponents(field);
}

function editorModal(kind, cfg, userId) {
  const modal = new ModalBuilder().setCustomId(`ticket_save_${kind}:${userId}`).setTitle('Personnaliser les tickets');
  if (kind === 'text') modal.addComponents(
    input('title', 'Titre du panneau', cfg.title, 256),
    input('description', 'Description (Markdown accepté)', cfg.description, 3000, true),
    input('footer', 'Texte en bas du panneau', cfg.footer, 200, false, false),
    input('color', 'Couleur hexadécimale (ex. #A855F7)', `#${cfg.color.toString(16).padStart(6, '0')}`, 7),
  );
  if (kind === 'topics') modal.addComponents(input('topics',
    'Une ligne : Nom | emoji ou - | description',
    cfg.topics.map(t => `${t.label} | ${t.emoji || '-'} | ${t.description || ''}`).join('\n'), 4000, true));
  if (kind === 'visual') modal.addComponents(
    input('image', 'URL de la bannière (vide = aucune)', cfg.image, 500, false, false),
    input('placeholder', 'Texte du menu déroulant', cfg.placeholder, 150),
  );
  return modal;
}

function buildRoutes(cfg, userId, topicId = cfg.topics[0].id) {
  const topic = cfg.topics.find(t => t.id === topicId);
  if (!topic) throw new Error('Ce type de ticket n’existe plus. Rouvre Catégories par type.');
  const routes = cfg.topic_categories || {};
  const selector = new StringSelectMenuBuilder().setCustomId(`ticket_route_topic:${userId}`)
    .setPlaceholder('Choisir le type de ticket à configurer')
    .addOptions(cfg.topics.map(t => ({ label: t.label, value: t.id, default: t.id === topicId })));
  const category = new ChannelSelectMenuBuilder().setCustomId(`ticket_route_category:${userId}:${topicId}`)
    .setPlaceholder(`Catégorie pour ${topic.label}`.slice(0, 150)).setChannelTypes(ChannelType.GuildCategory)
    .setMinValues(0).setMaxValues(1);
  if (routes[topicId]) category.setDefaultChannels(routes[topicId]);
  const summary = cfg.topics.map(t => `**${t.label}** → ${routes[t.id] ? `<#${routes[t.id]}>`
    : cfg.category_id ? `<#${cfg.category_id}> (par défaut)` : 'racine du serveur (par défaut)'}`);
  return {
    content: '**📂 Catégories par type de ticket**\nChoisis un type, puis sa catégorie. La sélection est enregistrée immédiatement.\n'
      + 'Efface la catégorie pour réutiliser la catégorie par défaut.',
    embeds: [new EmbedBuilder().setColor(cfg.color).setTitle(`Configurer : ${topic.label}`.slice(0, 256)).setDescription(summary.join('\n'))],
    components: [new ActionRowBuilder().addComponents(selector), new ActionRowBuilder().addComponents(category),
      new ActionRowBuilder().addComponents(button(`ticket_route_back:${userId}`, 'Retour au panneau', '↩️'))],
    allowedMentions: { parse: [] },
  };
}

function parseTopics(text, previousTopics = []) {
  const used = new Set();
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 25) throw new Error('Indique entre 1 et 25 choix.');
  return lines.map((line, index) => {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length > 3) throw new Error(`Ligne ${index + 1} : utilise Nom | emoji | description.`);
    const [label, rawEmoji = '', description = ''] = parts;
    if (!label || label.length > 100 || description.length > 100) {
      throw new Error(`Ligne ${index + 1} : nom obligatoire, 100 caractères maximum par nom et description.`);
    }
    const emoji = rawEmoji === '-' ? '' : rawEmoji;
    if (emoji && !/^(?:<a?:\w+:\d{17,20}>|\d{17,20}|(?=[\s\S]*\p{Extended_Pictographic})[\p{Extended_Pictographic}\p{Emoji_Component}\u200D\uFE0F]+|[0-9#*]\uFE0F?\u20E3)$/u.test(emoji)) {
      throw new Error(`Ligne ${index + 1} : choisis un emoji, un emoji personnalisé Discord, ou -.`);
    }
    const previous = previousTopics.find(t => !used.has(t.id) && t.label.toLowerCase() === label.toLowerCase());
    if (previous) used.add(previous.id);
    return { id: previous?.id || `topic_${randomUUID().slice(0, 8)}`, label, emoji, description };
  });
}

function applyEditor(cfg, kind, fields) {
  const next = structuredClone(cfg);
  if (kind === 'text') {
    next.title = fields.getTextInputValue('title').trim();
    next.description = fields.getTextInputValue('description').trim();
    next.footer = fields.getTextInputValue('footer').trim();
    const color = fields.getTextInputValue('color').trim();
    if (!/^#?[\da-f]{6}$/i.test(color)) throw new Error('Couleur invalide : exemple #A855F7.');
    next.color = parseInt(color.replace('#', ''), 16);
    if (!next.title || !next.description) throw new Error('Le titre et la description sont obligatoires.');
  } else if (kind === 'topics') next.topics = parseTopics(fields.getTextInputValue('topics'), cfg.topics);
  else if (kind === 'visual') {
    next.image = fields.getTextInputValue('image').trim();
    next.placeholder = fields.getTextInputValue('placeholder').trim();
    if (!next.placeholder) throw new Error('Le texte du menu est obligatoire.');
    if (next.image) {
      let url;
      try { url = new URL(next.image); } catch { throw new Error('Indique une URL valide pour la bannière.'); }
      if (url.protocol !== 'https:') throw new Error('La bannière doit utiliser une URL HTTPS.');
    }
  } else throw new Error('Éditeur inconnu.');
  return next;
}

async function publishPanel(cfg, guild) {
  const channel = await guild.channels.fetch(cfg.channel_id);
  if (!channel || channel.type !== 0) throw new Error('Choisis un salon texte avec &ticket setup #salon.');
  const payload = buildPanel(cfg, guild);
  // Snapshot the published choices: editing a draft must not change an existing menu's meaning.
  const published = { ...cfg, published_topics: structuredClone(cfg.topics) };
  let message;
  if (cfg.message_id) {
    try { message = await channel.messages.fetch(cfg.message_id); }
    catch (err) { if (err.code !== 10008) throw err; }
  }
  if (message) await message.edit(payload);
  else message = await channel.send(payload);
  published.message_id = message.id;
  // Persist the snapshot along with the panel after Discord accepts the update.
  saveConfig(published);
  return message;
}

module.exports = { DEFAULTS, getConfig, saveConfig, buildPanel, buildEditor, buildRoutes, editorModal, parseTopics, applyEditor, publishPanel, button, input };
