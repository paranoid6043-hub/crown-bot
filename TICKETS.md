# Tickets — Crown Bot

Redémarre le bot avec `npm.cmd start` dans PowerShell après l’installation du code.

## Installation

Avec un compte administrateur, propriétaire du serveur ou Sys+ :

1. `&ticket setup` ouvre le menu de configuration. `&ticket setup #tickets` présélectionne le salon du panneau.
2. Dans **Catégorie par défaut des tickets**, sélectionne une catégorie de secours. Avec **Catégories par type**, sélectionne **Aide**, puis sa catégorie ; sélectionne ensuite **Recrutement**, puis une autre catégorie. Chaque choix peut avoir sa propre destination. Efface une catégorie spécifique pour réutiliser celle par défaut.
3. Dans **Salon du panneau public**, sélectionne le salon où les membres ouvriront leurs tickets.
4. Dans **Rôle de l’équipe support**, sélectionne le rôle qui aura accès aux prochains tickets. Sans rôle, les administrateurs Discord gardent leur accès.
5. Personnalise le panneau avec les boutons, puis clique sur **Publier / actualiser** pour le publier.
6. Facultatif : `&ticket logs #archives-privees` envoie une transcription à chaque fermeture. Le salon doit être privé.

Les commandes `&ticket role @Support` et `&ticket category ID_CATEGORIE` restent disponibles, ainsi que les arguments de présélection `&ticket setup #tickets ID_CATEGORIE @Support`.

Le bot doit pouvoir voir les salons utilisés, envoyer des messages, intégrer des liens, joindre des fichiers, lire l’historique, gérer les salons et gérer les permissions des salons (Gérer les rôles). Vérifie aussi les permissions dans la catégorie choisie.

## Personnaliser le panneau

`&ticket config` rouvre le menu de configuration et l’aperçu avec cinq boutons :

- **Texte & couleur** : titre, description, signature et couleur hexadécimale.
- **Choix du menu** : de 1 à 25 sujets, une ligne par choix.
- **Image & menu** : URL HTTPS d’une bannière et texte du menu. Efface l’URL pour enlever la bannière.
- **Catégories par type** : choisis le type, puis sa catégorie. Le réglage est enregistré immédiatement pour les prochains tickets. Sans destination spécifique, le type utilise la catégorie par défaut ou la racine du serveur. Après avoir renommé un choix, sélectionne de nouveau sa catégorie ; réordonner les choix ou changer leurs descriptions conserve leurs destinations.
- **Publier / actualiser** : applique le brouillon au panneau public, sans le republier à chaque modification.

Exemple de choix :

```text
Recrutement | 📋 | Déposer une candidature pour rejoindre l’équipe
Aide | ⁉️ | Besoin d’un coup de main
Partenariat | 🤝 | Proposer une collaboration
Autre | - | Une autre demande
```

Les noms et descriptions des choix sont limités à 100 caractères. Les emojis Unicode et personnalisés Discord sont acceptés ; les emojis personnalisés doivent être accessibles au bot. Le texte de description du panneau est indépendant du menu : adapte aussi ta liste de sujets si tu en affiches une dans le texte.

Les réglages sont sauvegardés dans `crown.db.json`. Les boutons et menus fonctionnent après redémarrage sans relancer la configuration. Un panneau par serveur est actif ; `setup` peut le déplacer vers un autre salon.

## Utilisation

Le membre choisit un type et le salon privé est créé directement, sans formulaire. Le message d’accueil l’invite à expliquer sa demande dans le salon. Un seul ticket ouvert par membre et par serveur est autorisé. Les administrateurs Discord peuvent voir les tickets ; ajoute un rôle Support pour les autres intervenants. Les accès Sys+ permettent la configuration, mais il faut un accès Discord au salon pour le consulter.

- **Prendre en charge** : réservé au support, indique qui s’occupe du ticket.
- **Transcription** : fichier texte de la conversation, incluant les embeds et liens des pièces jointes. Les fichiers joints ne sont pas copiés. Les très longues conversations sont limitées aux 7 Mo de messages récents et marquées comme partielles.
- `&close` : ferme et supprime directement le salon du ticket, sans confirmation ni délai programmé. `&ticket close` fait la même chose. Si les logs sont configurés, la transcription est envoyée avant la suppression ; si cet envoi échoue, le salon est conservé et l’erreur est signalée.
- `&rename nouveau nom` : renomme le salon, par exemple `&rename recrutement paul` donne `recrutement-paul`. Un nom est obligatoire, avec une limite de 100 caractères. `&ticket rename nouveau nom` fonctionne aussi. Ces commandes sont réservées à l’auteur du ticket et au support et s’utilisent uniquement dans un ticket.
- Le bouton **Fermer** demande confirmation puis verrouille l’écriture du membre et des participants. Le salon reste consultable ; le support peut encore écrire.
- **Rouvrir** : réservé au support, réactive le ticket si son auteur n’en a pas déjà un autre ouvert.
- **Supprimer** : réservé au support, sur un ticket fermé, après confirmation. Télécharge d’abord la transcription si tu souhaites la conserver.
- `&ticket add @membre` / `&ticket remove @membre` : réservés au support, dans un ticket ouvert.

Les réglages `role`, `category` et `logs` acceptent `off`. Le changement du rôle support ou de la catégorie concerne les nouveaux tickets ; le rôle initial conserve son accès aux anciens tickets.

## Vérification locale

`node --test tests/tickets.test.js`

Les tests utilisent une base temporaire isolée, sans connexion à Discord et sans toucher aux données du bot. Pour valider le rendu et les permissions réels, installe le panneau dans un salon de test et ouvre un ticket avec un compte membre.
