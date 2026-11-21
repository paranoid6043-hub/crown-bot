const { ActivityType } = require('discord.js');
const { db } = require('../database');
const E = require('./embeds');
const pending = new Set();
const DEFAULT_ACTIVITY = '&help | Crown Bot';

function activityText(client) {
  const saved = db.prepare('SELECT * FROM bot_settings WHERE bot_id = ?').get(client.user.id);
  return saved?.activity_text ?? DEFAULT_ACTIVITY;
}

function restoreActivity(client) {
  const text = activityText(client);
  if (text) client.user.setActivity(text, { type: ActivityType.Watching });
  else client.user.setActivity();
}

async function isBotOwner(userId, client) {
  // Profile changes affect the account in every server, so server permissions do not grant access.
  const application = client.application.owner ? client.application : await client.application.fetch();
  const owner = application.owner;
  return Boolean(owner && userId === (owner.ownerId || owner.id));
}

function profileError(err, action) {
  const field = action === 'name' ? 'username' : action === 'avatar' ? 'avatar' : null;
  const details = [];
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value._errors)) {
      for (const item of value._errors) {
        if (typeof item.message === 'string') details.push(item.message);
        if (typeof item.code === 'string') details.push(item.code);
      }
    }
    for (const [key, child] of Object.entries(value)) if (key !== '_errors') collect(child);
  }
  collect(field ? err.rawError?.errors?.[field] : err.rawError?.errors);
  const diagnostic = [err.message, ...details].filter(Boolean).join(' ');
  const code = err.code ? ` (code ${String(err.code).replace(/[^\w-]/g, '').slice(0, 40)})` : '';
  if (err.status === 429 || err.name === 'RateLimitError'
    || /too fast|rate.?limit|too many.{0,60}(?:changes|requests)|USERNAME_RATE_LIMIT/i.test(diagnostic)) {
    const retry = Number(err.rawError?.retry_after ?? err.retry_after);
    const delay = Number.isFinite(retry) && retry > 0 ? ` Réessaie dans environ ${Math.ceil(retry / 60)} minute(s).`
      : ' Attends avant de réessayer ; redémarrer le bot ne supprime pas ce délai.';
    return `Discord bloque temporairement ${action === 'name' ? 'les changements de nom' : 'cette modification'} car ils sont trop rapprochés.${delay}`;
  }
  if (details.length) {
    const reason = details.join(' — ').replace(/[`\r\n]/g, ' ').slice(0, 650);
    return `Discord a refusé ${action === 'name' ? 'ce nom' : 'cette image'}${code}.\nRaison indiquée par Discord :\n\`${reason}\``;
  }
  return `Discord a refusé la modification${code}. Vérifie ${action === 'name' ? 'le nom demandé' : action === 'avatar' ? 'le lien et le format de l’image' : 'le statut demandé'}.`
    + (err.code ? '' : ' Vérifie aussi la connexion du bot.');
}

async function executeProfile(message, args, client, action) {
  const reply = description => message.reply({ embeds: [E.success(description)], allowedMentions: { parse: [] } });
  const fail = description => message.reply({ embeds: [E.error(description)], allowedMentions: { parse: [] } });
  let key;
  let acquired = false;
  try {
    if (!await isBotOwner(message.author.id, client)) return fail('Seul le propriétaire de l’application du bot peut modifier son profil.');
    key = `${client.user.id}:${action}${action === 'nickname' ? `:${message.guild?.id}` : ''}`;
    if (pending.has(key)) return fail('Cette modification est déjà en cours. Patiente avant de réessayer.');
    pending.add(key);
    acquired = true;
    const value = args.join(' ').trim();
    if (action === 'nickname') {
      if (!message.guild) return fail('Cette commande s’utilise dans un serveur Discord.');
      if (!value || value.length > 32) return fail('Utilise `&setname nouveau nom` (entre 1 et 32 caractères).');
      const me = await message.guild.members.fetchMe();
      if ((me.nickname || client.user.username) === value) return reply('Le bot affiche déjà ce nom sur ce serveur.');
      await me.setNickname(value, `Nom du bot modifié par ${message.author.id}`);
      return reply(`Nom affiché sur ce serveur : **${value}**.\nLe nom global du compte reste inchangé. Pour le modifier : \`&setusername nouveau nom\`.`);
    }
    if (action === 'status') {
      if (!value) return fail('Utilise `&setstatus ton texte` ou `&setstatus off` pour masquer l’activité.');
      if (value.length > 128) return fail('Le texte du statut doit contenir au maximum 128 caractères.');
      const text = value.toLowerCase() === 'off' ? '' : value;
      if (text) client.user.setActivity(text, { type: ActivityType.Watching });
      else client.user.setActivity();
      db.prepare('INSERT OR REPLACE INTO bot_settings (bot_id, activity_text) VALUES (?, ?)').run(client.user.id, text);
      return reply(text ? `Statut mis à jour : **${text}**. Il sera conservé après redémarrage.` : 'Activité masquée.');
    }
    if (action === 'name') {
      if (value.length < 2 || value.length > 32) return fail('Utilise `&setusername nouveau nom` (entre 2 et 32 caractères).');
      if (client.user.username === value) return reply('Le bot porte déjà ce nom.');
      await client.user.setUsername(value);
      return reply(`Nom du bot mis à jour : **${value}**.`);
    }
    if (action === 'avatar') {
      const attachment = message.attachments?.first();
      const source = value || attachment?.url;
      if (!source) return fail('Utilise `&setavatar URL` ou envoie `&setavatar` avec une image jointe.');
      let url;
      try { url = new URL(source); } catch { return fail('Indique un lien HTTPS valide vers une image, ou joins une image au message.'); }
      if (url.protocol !== 'https:' || url.username || url.password) return fail('La photo doit être une image accessible par un lien HTTPS.');
      if (!value && attachment?.contentType && !/^image\//.test(attachment.contentType)) return fail('La pièce jointe doit être une image.');
      await client.user.setAvatar(url.href);
      return reply('Photo de profil du bot mise à jour.');
    }
    return fail('Modification de profil inconnue.');
  } catch (err) {
    console.error('Profil du bot :', err.message);
    if (action === 'nickname' && (err.code === 50013 || err.code === 50001)) {
      return fail('Le bot ne peut pas modifier son surnom ici. Autorise la permission **Changer le pseudo** dans son rôle, puis réessaie `&setname nouveau nom`.');
    }
    return fail(profileError(err, action));
  } finally { if (acquired) pending.delete(key); }
}

module.exports = { executeProfile, restoreActivity, activityText, isBotOwner };
