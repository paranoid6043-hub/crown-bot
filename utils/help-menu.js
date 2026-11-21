const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, escapeMarkdown,
} = require('discord.js');
const { randomBytes } = require('crypto');
const config = require('../config');
const { getUserLevel, hasPermission } = require('./permissions');

const COLOR = 0x8B5CF6;
const PAGE_SIZE = 6;
const LIFETIME = 10 * 60_000;
const sessions = new Map();
const CATEGORIES = [
  { id: 'moderation', label: 'Modération', emoji: '🔨', description: 'Sanctions, membres et historique' },
  { id: 'security', label: 'Protection', emoji: '🛡️', description: 'Anti-spam, liens et mentions' },
  { id: 'tickets', label: 'Tickets', emoji: '🎫', description: 'Support, recrutement et participants' },
  { id: 'voice', label: 'Vocal', emoji: '🎙️', description: 'Salons personnels, privés et déplacements' },
  { id: 'community', label: 'Communauté', emoji: '👋', description: 'Bienvenue, rôles, niveaux et invitations' },
  { id: 'games', label: 'Jeux & concours', emoji: '🎲', description: 'Mini-jeux et giveaways' },
  { id: 'tools', label: 'Utilitaires', emoji: '🧰', description: 'Informations, rappels et outils' },
  { id: 'settings', label: 'Configuration', emoji: '⚙️', description: 'Accès, logs, compteurs et commandes' },
  { id: 'profile', label: 'Profil du bot', emoji: '✨', description: 'Nom, photo et texte d’activité' },
];
const PROFILE = new Set(['setname', 'setusername', 'setavatar', 'setstatus']);
const NOTES = {
  ticket: { access: 'Configuration : Administrateur Discord ou Sys+. Gestion : auteur du ticket ou support selon l’action.', examples: ['ticket setup', 'ticket config', 'ticket add @membre'], note: 'Dans Catégories par type, choisis une destination différente pour Aide et Recrutement. Le choix d’un type ouvre directement le salon.' },
  close: { access: 'Auteur du ticket ou équipe support, uniquement dans un ticket.', examples: ['close'], note: 'Cette commande supprime directement le salon, sans confirmation. Si les logs sont configurés, la transcription est sauvegardée avant suppression.' },
  rename: { access: 'Auteur du ticket ou équipe support, uniquement dans un ticket.', examples: ['rename recrutement paul'], note: 'Les espaces du nom deviennent des tirets. Le nom est limité à 100 caractères.' },
  welcome: { access: 'Administrateur Discord ou Sys+.', examples: ['welcome setup', 'welcome test', 'welcome off'], note: 'Choisis le salon et le rôle dans les menus. Le rôle du bot doit être au-dessus du rôle à attribuer, avec la permission Gérer les rôles.' },
  setname: { access: 'Propriétaire de l’application du bot.', examples: ['setname Mon Bot'], note: 'Change le surnom affiché sur ce serveur. Le bot doit avoir la permission Changer le pseudo.' },
  setusername: { access: 'Propriétaire de l’application du bot.', examples: ['setusername Mon Bot'], note: 'Change le nom global du compte. Discord peut imposer un délai entre les changements.' },
  setavatar: { access: 'Propriétaire de l’application du bot.', examples: ['setpp https://exemple.com/image.png'], note: 'Tu peux aussi joindre une image à un message contenant &setpp. La photo du compte est commune à ses serveurs.' },
  setstatus: { access: 'Propriétaire de l’application du bot.', examples: ['setstatus &help | Mon serveur', 'setstatus off'], note: 'Le texte d’activité est sauvegardé et restauré après redémarrage.' },
  acc: { access: 'Propriétaire du vocal privé.', note: 'Cette commande doit être utilisée dans ton vocal privé.' },
  voc: { access: 'Membre disposant de son propre vocal personnel.' },
};
function categoryFor(command, client) {
  const folder = client.commandFolders?.get(command.name);
  if (PROFILE.has(command.name)) return 'profile';
  if (command.name === 'guide') return 'settings';
  if (['rank', 'leaderboard', 'welcome', 'sticky'].includes(command.name)) return 'community';
  if (['help', 'ping', 'botinfo', 'userinfo', 'remind'].includes(command.name)) return 'tools';
  if (['hide', 'unhide'].includes(command.name)) return 'tools';
  const folders = { antiraid: 'security', moderation: 'moderation', tickets: 'tickets', vocal: 'voice',
    pv: 'voice', perso: 'voice', suivi: 'voice', invites: 'community', rolemenu: 'community',
    games: 'games', giveaways: 'games', config: 'settings', salons: 'tools', utilitaire: 'tools' };
  return folders[folder] || 'tools';
}
function catalogue(client) {
  return [...new Map([...client.commands.values()].filter(c => c.name).map(c => [c.name, c])).values()]
    .map(command => ({ ...command, group: categoryFor(command, client) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
function normalize(value) { return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim(); }
function access(command) { return NOTES[command.name]?.access || command.permission || 'Public'; }
function available(command, context) {
  if (PROFILE.has(command.name)) return context.botOwner;
  if (['welcome', 'ticket', 'close', 'rename', 'voc', 'acc'].includes(command.name)) return true;
  return !command.permission || hasPermission(context.userId, context.guild, command.permission);
}
function filteredCommands(context, state) {
  let commands = catalogue(context.client);
  if (state.mine) commands = commands.filter(c => available(c, context));
  if (state.view === 'category') commands = commands.filter(c => c.group === state.category);
  if (state.view === 'search') {
    const terms = normalize(state.query).split(/\s+/).filter(Boolean);
    commands = commands.filter(c => terms.every(term => normalize([c.name, ...(c.aliases || []), c.description,
      CATEGORIES.find(cat => cat.id === c.group)?.label].join(' ')).includes(term)));
  }
  return commands;
}
function uptime(ms) {
  const minutes = Math.max(0, Math.floor((ms || 0) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes / 60) % 24;
  return `${days ? `${days} j ` : ''}${hours} h ${minutes % 60} min`;
}
function botName(context) { return context.guild.members.me?.displayName || context.client.user.username; }
function baseEmbed(context) {
  const icon = context.client.user.displayAvatarURL({ size: 256 });
  return new EmbedBuilder().setColor(COLOR)
    .setAuthor({ name: `${botName(context)} · Centre d’aide`.slice(0, 256), iconURL: icon })
    .setFooter({ text: `${context.guild.name} · Préfixe ${config.prefix} · Menu personnel · 10 min`.slice(0, 2048) });
}
function guideEmbed(context) {
  return baseEmbed(context).setTitle('🚀 Ton serveur, prêt en quelques étapes')
    .setDescription('Ouvre les panneaux de configuration, choisis tes réglages et teste le résultat. Les commandes ci-dessous sont des exemples à taper toi-même.')
    .addFields(
      { name: '01 · Support & recrutement', value: '`&ticket setup`\nChoisis le salon du panneau et le support. **Catégories par type** sépare Aide et Recrutement. Termine avec **Publier / actualiser**.' },
      { name: '02 · Accueil des membres', value: '`&welcome setup`\nChoisis le salon de bienvenue et le rôle automatique. Vérifie que le rôle du bot est au-dessus du rôle à donner. Teste avec `&welcome test`.' },
      { name: '03 · Identité du bot', value: '`&setname Mon Bot` · `&setstatus &help | Mon serveur`\nPour la photo : `&setpp` avec une image jointe. Ces commandes sont réservées au propriétaire de l’application.' },
      { name: '04 · Protection & équipe', value: '`&antiraid` affiche la configuration.\n`&setup` affiche les accès internes. Les niveaux du bot sont **Public → WL → Owner → Sys → Sys+** ; ils sont distincts des permissions Discord.' },
    );
}
function buildView(context, state, id) {
  const all = catalogue(context.client);
  const categories = CATEGORIES.filter(cat => all.some(c => c.group === cat.id));
  let embed = baseEmbed(context);
  let listed = [];
  let pages = 1;
  if (state.view === 'home') {
    embed.setTitle('Tout ton serveur, à portée de commande.')
      .setThumbnail(context.client.user.displayAvatarURL({ size: 256 }))
      .setDescription(`**${escapeMarkdown(botName(context))}**\nModération, protection et vie du serveur : retrouve tes outils dans un seul espace.\n\nChoisis une **catégorie** dans le menu ou utilise **Rechercher**.`)
      .addFields({ name: '✦ En un coup d’œil', value: `**${all.length}** commandes  ·  **${categories.length}** catégories  ·  Préfixe **${config.prefix}**\nTon niveau : **${getUserLevel(context.userId, context.guild)}**` });
    for (const cat of categories) {
      const count = all.filter(c => c.group === cat.id).length;
      embed.addFields({ name: `${cat.emoji} ${cat.label}`, value: `${cat.description}\n**${count} commandes**`, inline: true });
    }
    embed.addFields({ name: 'Tu sais déjà ce que tu cherches ?', value: '`&help ticket` pour une fiche détaillée\n`&help bienvenue` pour retrouver un alias\n**Guide de départ** pour configurer ton serveur.' });
  } else if (state.view === 'guide') embed = guideEmbed(context);
  else if (state.view === 'detail') {
    const command = all.find(c => c.name === state.command);
    if (!command) throw new Error('Cette commande n’existe plus. Rouvre &help.');
    const cat = CATEGORIES.find(c => c.id === command.group);
    embed.setTitle(`${cat.emoji} ${config.prefix}${command.name}`).setDescription(command.description || 'Consulte la syntaxe ci-dessous.')
      .addFields({ name: 'Utilisation', value: `\`\`\`text\n${(command.usage || config.prefix + command.name).slice(0, 950)}\n\`\`\`` },
        { name: 'Accès', value: access(command), inline: true }, { name: 'Catégorie', value: cat.label, inline: true });
    if (command.aliases?.length) embed.addFields({ name: 'Autres noms', value: command.aliases.map(a => `\`${config.prefix}${a}\``).join(' · ').slice(0, 1024) });
    if (NOTES[command.name]?.examples) embed.addFields({ name: 'Exemples', value: NOTES[command.name].examples.map(e => `\`${config.prefix}${e}\``).join('\n') });
    if (NOTES[command.name]?.note) embed.addFields({ name: 'À savoir', value: NOTES[command.name].note });
    embed.addFields({ name: 'Lire la syntaxe', value: '`<argument>` : obligatoire · `[argument]` : facultatif\nLes mentions comme `@membre` et `#salon` doivent être remplacées dans Discord.' });
  } else {
    const results = filteredCommands(context, state);
    pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    state.page = Math.min(Math.max(0, state.page || 0), pages - 1);
    listed = results.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
    const cat = categories.find(c => c.id === state.category);
    embed.setTitle(state.view === 'search' ? '🔎 Résultats de recherche' : `${cat?.emoji || '📚'} ${cat?.label || 'Commandes'}`)
      .setDescription((state.view === 'search' ? (state.query ? `Recherche : **${escapeMarkdown(state.query)}**\n` : 'Catalogue des commandes\n') : `${cat?.description || ''}\n`)
        + `**${results.length} commande(s)** · Page **${state.page + 1}/${pages}**\nSélectionne une commande pour consulter sa fiche.`
        + (state.mine ? '\nFiltre de niveau actif ; les conditions liées aux tickets et aux vocaux restent applicables.' : ''));
    for (const command of listed) embed.addFields({ name: `${config.prefix}${command.name}`, value: `${command.description || 'Aide disponible.'}\n**Accès :** ${access(command)}`.slice(0, 1024) });
    if (!listed.length) embed.addFields({ name: 'Aucun résultat', value: 'Essaie un nom plus court, un alias ou un autre mot-clé. Le filtre **Mon niveau** peut également masquer des commandes.' });
  }
  const row = components => new ActionRowBuilder().addComponents(...components);
  const select = new StringSelectMenuBuilder().setCustomId(`help:${id}:category`).setPlaceholder('Parcourir une catégorie…')
    .addOptions(categories.map(cat => ({ label: cat.label, value: cat.id, emoji: cat.emoji,
      description: cat.description, default: state.view === 'category' && state.category === cat.id })));
  const components = [row([select])];
  if (listed.length) components.push(row([new StringSelectMenuBuilder().setCustomId(`help:${id}:command`)
    .setPlaceholder('Voir la fiche d’une commande…').addOptions(listed.map(c => ({ label: config.prefix + c.name, value: c.name, description: (c.description || 'Consulter la commande').slice(0, 100) })))]));
  const button = (action, label, style = ButtonStyle.Secondary, disabled = false) => new ButtonBuilder()
    .setCustomId(`help:${id}:${action}`).setLabel(label).setStyle(style).setDisabled(disabled);
  if (state.view === 'category' || state.view === 'search') components.push(row([
    button('prev', '← Précédent', ButtonStyle.Secondary, !state.page),
    button('page', `${state.page + 1} / ${pages}`, ButtonStyle.Secondary, true),
    button('next', 'Suivant →', ButtonStyle.Secondary, state.page >= pages - 1),
  ]));
  components.push(row([button('home', 'Accueil', ButtonStyle.Primary, state.view === 'home'),
    button('search', 'Rechercher'), button('guide', 'Guide de départ'),
    button('filter', state.mine ? 'Mon niveau ✓' : 'Toutes les commandes', state.mine ? ButtonStyle.Success : ButtonStyle.Secondary),
    button('close', 'Fermer')]));
  return { embeds: [embed], components, allowedMentions: { parse: [], repliedUser: false } };
}
function expire(id) {
  const session = sessions.get(id);
  if (!session) return;
  clearTimeout(session.timer);
  sessions.delete(id);
  session.message?.edit({ components: [] }).catch(() => {});
}
async function openHelp(message, args, client) {
  let botOwner = false;
  try { botOwner = await require('./bot-profile').isBotOwner(message.author.id, client); }
  catch (err) { console.error('Vérification du profil pour l’aide :', err.message); }
  const context = { client, guild: message.guild, userId: message.author.id, botOwner };
  let query = args.join(' ').trim().replace(new RegExp(`^${config.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '').slice(0, 100);
  const exact = client.commands.get(query.toLowerCase());
  const category = CATEGORIES.find(cat => [normalize(cat.label), cat.id].includes(normalize(query)));
  const state = { view: !query ? 'home' : ['guide', 'setup', 'demarrage'].includes(normalize(query)) ? 'guide'
    : exact ? 'detail' : category ? 'category' : 'search', command: exact?.name, category: category?.id, query, page: 0, mine: false };
  const id = randomBytes(6).toString('hex');
  if (sessions.size >= 300) expire(sessions.keys().next().value);
  const session = { context, state, message: null, busy: false };
  sessions.set(id, session);
  try {
    session.message = await message.reply(buildView(context, state, id));
    session.timer = setTimeout(() => expire(id), LIFETIME);
    session.timer.unref?.();
  } catch (err) { sessions.delete(id); throw err; }
}
async function handleHelpInteraction(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const session = sessions.get(id);
  const fail = content => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  if (!session || session.context.guild.id !== interaction.guildId) return fail('Ce menu a expiré. Tape `&help` pour en ouvrir un nouveau.');
  if (session.context.userId !== interaction.user.id) return fail('Ce menu appartient à un autre membre. Tape `&help` pour ouvrir le tien.');
  if (session.busy) return fail('Le menu se met à jour, réessaie dans un instant.');
  session.busy = true;
  try {
    if (action === 'search') return await interaction.showModal(new ModalBuilder().setCustomId(`help:${id}:query`).setTitle('Rechercher une commande')
      .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('query').setLabel('Nom, alias ou mot-clé')
        .setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true).setPlaceholder('Exemple : ticket, bienvenue, ban…'))));
    await interaction.deferUpdate();
    if (action === 'close') {
      clearTimeout(session.timer);
      sessions.delete(id);
      return await interaction.editReply({ components: [] });
    }
    const state = session.state;
    if (action === 'home' || action === 'guide') { state.view = action; state.page = 0; }
    else if (action === 'category') {
      if (!CATEGORIES.some(cat => cat.id === interaction.values[0])) throw new Error('Catégorie inconnue.');
      state.view = 'category'; state.category = interaction.values[0]; state.page = 0;
    } else if (action === 'command') { state.view = 'detail'; state.command = interaction.values[0]; }
    else if (action === 'filter') {
      state.mine = !state.mine; state.page = 0;
      if (['home', 'guide', 'detail'].includes(state.view)) { state.view = 'search'; state.query = ''; }
    }
    else if (action === 'prev') state.page--;
    else if (action === 'next') state.page++;
    else if (action === 'query') { state.query = interaction.fields.getTextInputValue('query').trim(); state.view = 'search'; state.page = 0; }
    else throw new Error('Action inconnue. Rouvre &help.');
    await interaction.editReply(buildView(session.context, state, id));
  } catch (err) {
    console.error('Menu aide :', err.message);
    const payload = { content: 'Impossible de mettre à jour le menu. Tape `&help` pour réessayer.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  } finally { session.busy = false; }
}
module.exports = { openHelp, handleHelpInteraction, catalogue, buildView, CATEGORIES, filteredCommands, uptime, baseEmbed, expire };
