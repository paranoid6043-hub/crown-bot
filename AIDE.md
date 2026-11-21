# Centre d’aide

Dans PowerShell, depuis le dossier du bot, redémarre avec `npm.cmd start`.

## Commandes

- `&help` : accueil avec le nom et la photo du bot, neuf catégories et menus de navigation.
- `&help ticket` : fiche d’une commande, avec syntaxe, accès, alias et exemples lorsqu’ils sont disponibles.
- `&help bienvenue` : accepte aussi les alias.
- `&help protection` : ouvre directement une catégorie.
- `&help mot-clé` : recherche dans les noms, descriptions, catégories et alias.
- `&guide` : guide de départ pour les tickets, la bienvenue, le profil et la protection.
- `&ping` : latence du message et de la connexion Discord.
- `&botinfo` : nombre de commandes, catégories et durée de connexion.

`&aide`, `&commands` et `&commandes` ouvrent aussi le centre d’aide.

## Navigation

Le premier menu sélectionne une catégorie. Le second permet d’ouvrir une fiche de commande. Les boutons changent de page, ouvrent la recherche, affichent le guide ou ferment la navigation.

**Toutes les commandes** active le filtre **Mon niveau**. Il tient compte des niveaux internes Public, WL, Owner, Sys et Sys+, ainsi que du propriétaire de l’application pour les commandes de profil. Les conditions spécifiques aux tickets et aux vocaux restent précisées dans les fiches. Le centre d’aide n’exécute aucune commande de configuration.

Chaque menu appartient à la personne qui l’a ouvert et dure dix minutes. Un menu expiré, fermé ou antérieur au redémarrage doit être rouvert avec `&help`.

Le catalogue est construit depuis les commandes réellement chargées. Les alias ne sont pas comptés comme des commandes supplémentaires. Le nom et l’avatar affichés suivent le profil du bot ; le surnom du serveur est utilisé lorsqu’il est disponible.

## Vérification

`npm.cmd test` lance les tests locaux sans connecter le bot à Discord. Le rendu final, les notifications et les permissions réelles doivent être vérifiés sur le serveur.
