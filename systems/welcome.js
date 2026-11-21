const {
  EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  ChannelType, PermissionFlagsBits: P, MessageFlags,
} = require('discord.js');
const { db } = require('../database');
const { hasPermission } = require('../utils/permissions');
const config = require('../config');
const DEFAULT_MESSAGE = 'Bienvenue {user} sur **{server}** ! 🎉\nInstalle-toi et passe un bon moment avec nous.\nNous sommes maintenant **{membercount} membres** !';

function getSettings(guildId) {
  return { enabled: true, message: DEFAULT_MESSAGE,
    ...db.prepare('SELECT * FROM welcome WHERE guild_id = ?').get(guildId), guild_id: guildId };
}
function saveSettings(settings) {
  db.prepare('INSERT OR REPLACE INTO welcome (guild_id, channel_id, role_id, message, enabled) VALUES (?, ?, ?, ?, ?)')
    .run(settings.guild_id, settings.channel_id || null, settings.role_id || null, settings.message, settings.enabled);
}
function canConfigure(member, guild) {
  return member.id === guild.ownerId || member.permissions.has(P.Administrator) || hasPermission(member.id, guild, 'Sys+');
}
function renderMessage(settings, member) {
  const values = { user: `<@${member.id}>`, username: member.user.username, server: member.guild.name, membercount: member.guild.memberCount };
  return (settings.message || DEFAULT_MESSAGE).replace(/\{(user|username|server|membercount)\}/g, (_, key) => String(values[key])).slice(0, 4096);
}
function welcomePayload(settings, member) {
  return {
    // A mention in message content triggers the ping; an embed alone does not.
    content: `👋 Bienvenue <@${member.id}> !`,
    embeds: [new EmbedBuilder().setColor(config.accentColor).setTitle('Bienvenue sur le serveur !')
      .setDescription(renderMessage(settings, member)).setThumbnail(member.user.displayAvatarURL({ size: 256 })).setTimestamp()],
    allowedMentions: { parse: [], users: [member.id], roles: [], repliedUser: false },
  };
}
function buildEditor(settings, userId) {
  const channel = new ChannelSelectMenuBuilder().setCustomId(`welcome_channel:${userId}`)
    .setPlaceholder('📨 Salon des messages de bienvenue').setChannelTypes(ChannelType.GuildText).setMinValues(0).setMaxValues(1);
  const role = new RoleSelectMenuBuilder().setCustomId(`welcome_role:${userId}`)
    .setPlaceholder('🎭 Rôle donné aux nouveaux membres').setMinValues(0).setMaxValues(1);
  if (settings.channel_id) channel.setDefaultChannels(settings.channel_id);
  if (settings.role_id) role.setDefaultRoles(settings.role_id);
  const button = (action, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(`welcome_${action}:${userId}`).setLabel(label).setStyle(style);
  return {
    embeds: [new EmbedBuilder().setColor(config.accentColor).setTitle('👋 Bienvenue & rôle automatique')
      .setDescription('Choisis le salon et le rôle dans les menus. Les réglages sont enregistrés automatiquement.\n'
        + 'À chaque arrivée, le membre sera mentionné dans ce salon et recevra le rôle sélectionné.\n'
        + 'Efface une sélection pour désactiver uniquement le message ou le rôle.')
      .addFields(
        { name: 'État', value: settings.enabled ? '🟢 Activé' : '🔴 Désactivé', inline: true },
        { name: 'Salon', value: settings.channel_id ? `<#${settings.channel_id}>` : 'Non défini', inline: true },
        { name: 'Rôle', value: settings.role_id ? `<@&${settings.role_id}>` : 'Non défini', inline: true },
        { name: 'Message', value: (settings.message || DEFAULT_MESSAGE).slice(0, 1024) },
      ).setFooter({ text: 'Le rôle du bot doit être placé au-dessus du rôle à attribuer.' })],
    components: [new ActionRowBuilder().addComponents(channel), new ActionRowBuilder().addComponents(role),
      new ActionRowBuilder().addComponents(button('text', '✏️ Modifier le message'), button('test', '🧪 Tester le message'),
        button('toggle', settings.enabled ? 'Désactiver' : 'Activer', settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success))],
    allowedMentions: { parse: [] },
  };
}
async function validateRole(guild, roleId) {
  const role = await guild.roles.fetch(roleId);
  const me = await guild.members.fetchMe();
  if (!role || role.id === guild.id || role.managed) throw new Error('Choisis un rôle normal, différent de @everyone et des rôles de bots.');
  if (!me.permissions.has(P.ManageRoles)) throw new Error('Le bot a besoin de la permission **Gérer les rôles**.');
  if (!role.editable) throw new Error('Place le rôle du bot **au-dessus** du rôle à attribuer dans les paramètres du serveur.');
  return role;
}
async function validateChannel(guild, channelId) {
  const channel = await guild.channels.fetch(channelId);
  const me = await guild.members.fetchMe();
  if (channel?.type !== ChannelType.GuildText) throw new Error('Choisis un salon texte du serveur.');
  if (!channel.permissionsFor(me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) throw new Error('Le bot doit pouvoir voir ce salon, envoyer des messages et intégrer des liens.');
  return channel;
}
async function testMessage(member) {
  const settings = getSettings(member.guild.id);
  if (!settings.channel_id) throw new Error('Choisis d’abord le salon de bienvenue.');
  const channel = await validateChannel(member.guild, settings.channel_id);
  await channel.send(welcomePayload(settings, member));
}
async function handleWelcome(member) {
  if (member.user.bot) return;
  const settings = getSettings(member.guild.id);
  if (!settings.enabled) return;
  const tasks = [];
  if (settings.role_id) tasks.push((async () => {
    const role = await validateRole(member.guild, settings.role_id);
    await member.roles.add(role.id, 'Rôle automatique à l’arrivée sur le serveur');
  })());
  if (settings.channel_id) tasks.push((async () => {
    const channel = await validateChannel(member.guild, settings.channel_id);
    await channel.send(welcomePayload(settings, member));
  })());
  const results = await Promise.allSettled(tasks);
  for (const result of results) if (result.status === 'rejected') console.error(`Bienvenue (${member.guild.id}) :`, result.reason.message);
}
async function handleWelcomeInteraction(interaction) {
  let updated = false;
  try {
    if (!interaction.guild) throw new Error('Utilise cette configuration dans un serveur.');
    const [action, ownerId] = interaction.customId.split(':');
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (ownerId !== interaction.user.id || !canConfigure(member, interaction.guild)) throw new Error('Ce menu est réservé à son administrateur. Utilise `&welcome setup`.');
    const settings = getSettings(interaction.guildId);
    if (action === 'welcome_text') {
      return await interaction.showModal(new ModalBuilder().setCustomId(`welcome_save:${ownerId}`).setTitle('Message de bienvenue')
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message')
          .setLabel('Variables : {user} {username} {server}')
          .setPlaceholder('Bienvenue {user} sur {server} ! Membres : {membercount}')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000).setValue((settings.message || DEFAULT_MESSAGE).slice(0, 2000)))));
    }
    if (action === 'welcome_test') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await testMessage(member);
      return await interaction.editReply({ content: '✅ Message de test envoyé dans le salon choisi. Aucun rôle n’a été attribué pendant le test.' });
    }
    await interaction.deferUpdate();
    updated = true;
    const next = getSettings(interaction.guildId);
    if (action === 'welcome_channel') {
      const id = interaction.values[0] || null;
      if (id) await validateChannel(interaction.guild, id);
      next.channel_id = id;
    } else if (action === 'welcome_role') {
      const id = interaction.values[0] || null;
      if (id) await validateRole(interaction.guild, id);
      next.role_id = id;
    } else if (action === 'welcome_toggle') next.enabled = !next.enabled;
    else if (action === 'welcome_save') {
      const text = interaction.fields.getTextInputValue('message').trim();
      if (!text) throw new Error('Le message ne peut pas être vide.');
      next.message = text;
    } else throw new Error('Action de bienvenue inconnue.');
    saveSettings(next);
    await interaction.editReply(buildEditor(next, ownerId));
  } catch (err) {
    console.error('Configuration bienvenue :', err.message);
    const content = err.code ? 'Discord a refusé l’action. Vérifie les permissions du bot et les éléments choisis.' : err.message;
    const payload = { content, allowedMentions: { parse: [] } };
    if (updated || interaction.replied) await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    else if (interaction.deferred) await interaction.editReply(payload).catch(() => {});
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
module.exports = { handleWelcome, handleWelcomeInteraction, getSettings, saveSettings, canConfigure, buildEditor, testMessage, welcomePayload };
