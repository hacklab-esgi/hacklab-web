---
title: "Gérer la crise à l'aveugle : Le SOC face à la chute d'Exchange Online"
description: "Retour d'expérience d'un analyste SOC pendant la panne mondiale de Microsoft 365 du 13 novembre 2026 : comment garder une vision, même dégradée, quand l'essentiel des outils de détection dépend de Microsoft."
createdAt: 2026-11-16
category: defensif
tags:
  - soc
  - blue-team
  - microsoft
  - defender
  - kql
  - retex
draft: true
author: "Mat4Shell"
---

## `TL;DR`

Entre le jeudi 12 et le samedi 14 novembre 2026, une panne mondiale d'Exchange Online a paralysé Microsoft 365. Pour notre SOC, chez un client dont l'essentiel des outils de sécurité repose sur Microsoft, cela s'est traduit le vendredi par une console Defender quasi inutilisable, plus aucune alerte dans le SOAR et une entreprise sous tension avec une activité cyber intense.

Vérifier la chaîne de détection avec des requêtes KQL, basculer sur une source de détection indépendante de Microsoft et tenir le client informé jusqu'au retour des services, voici le retour d'expérience d'un analyste SOC en pleine crise mondiale et une leçon que j'en retiens : un SOC n'a pas le droit d'être aveugle, alors quand ses yeux habituels tombent, il doit en trouver d'autres par tous les moyens possibles.

## La panne en quelques mots

Tout est parti d'**Exchange Online**, le service de Microsoft responsable des boîtes mail professionnelles des clients Microsoft 365. À partir du jeudi 12 novembre au soir, de nombreux utilisateurs n'ont plus pu se connecter à Outlook, recevoir ou envoyer des mails. Teams a mieux résisté : la messagerie instantanée et la visio fonctionnaient globalement, mais les calendriers et la planification de réunions (qui dépendent d'Exchange) étaient également perturbés. Des perturbations ont été signalées dans plus de 70 pays.

Côté causes, Microsoft a écarté à la fois la cyberattaque et la piste d'un raté lié à l'IA ou à ses agents. Ils évoquent une upgrade de capacité réseau dont le défaut ne s'est révélé qu'après un changement réseau ultérieur. Sur les serveurs touchés, le processus chargé d'établir les connexions sécurisées était saturé, si bien que les machines ont finies par ne plus traiter les demandes. Le rétablissement s'est fait par étapes avec un contrôle de stabilité à chacune d'elles jusqu'à l'annonce d'un retour complet le samedi matin. Microsoft promet un rapport post-incident complet sans date annoncée à l'heure de l'écriture de cet article. Les incidents étaient suivis sous les références **EX1550543** et **MO1550821**.

Je ne vais pas aller plus loin sur l'origine technique : d'autres l'ont très bien couverte (voir les sources en fin d'article). Ce qui m'intéresse ici c'est raconter ce que cette panne a provoqué de l'autre côté de l'écran dans un SOC.

## Pourquoi c'est un problème cyber et pas seulement un problème de mails

Beaucoup d'entreprises ont consolidé leur sécurité au sein de l'écosystème Microsoft : l'EDR avec **Defender for Endpoint (MDE)**, le SIEM avec **Sentinel**, sans compter l'identité (IAM), la messagerie et les outils collaboratifs.
Bien que cohérente sur le papier (intégration native, une seule console, des automatisations plus simples), cette architecture expose l'entreprise à 2 fronts en même temps le jour où cet écosystème flanche :

- son **activité** est perturbée (plus de mails, des outils de travail lents ou indisponibles)
- sa **défense** l'est aussi : les consoles de sécurité rament, les automatisations alimentées par Microsoft peuvent ne plus produire de cases et certains canaux habituels pour prévenir ou être prévenu sont down.

Et une crise mondiale de ce genre est surtout une opportunité pour les attaquants :
Microsoft Threat Intelligence a par exemple repéré et remonté des mails de phishing imitant ses alertes officielles. Ils citaient le vrai numéro d'incident (EX1550543) et poussaient la victime à cliquer pour « restaurer » ses messages bloqués, dans le but de voler ses identifiants.

Ces faux messages ont été observés dans des organisations américaines, autrement dit, c'est précisément le moment où un SOC doit être le plus attentif... et à l'inverse celui où ses outils l'aident le moins.

## Petite remise en contexte

Je suis étudiant en 5e SI à l'ESGI et analyste SOC en alternance chez I-TRACING. Je travaille dans une équipe dédiée à un seul client : une entreprise internationale de milliers de collaborateurs et disposant d'une activité industrielle marquée.

Une partie de nos outils de sécurité sur ce périmètre est chez Microsoft. On y retrouve MDE et Sentinel (déprécié il y a peu au profit de MDE) et notre **SOAR** relié à MDE : c'est par ce lien que remontent les alertes de détection (qui donnent lieu à la création des incidents que nous traitons) et que passe une partie de notre automatisation.
À côté, nous disposons d'autres sources de détection diverses qui complètent les outils Microsoft. Toute source d'information permettant la compréhension et contextualisation des évènements de sécurité a son importance.

Autre élément de contexte : l'activité cyber est particulièrement marquée notamment par la gestion de menaces émergentes et une géopolitique complexe. La tension est forte pour les équipes IT et cyber et dans ce contexte, annoncer que "le SOC est aveugle" n'est pas envisageable.

## Vendredi matin : un SOC sans yeux

À notre arrivée le vendredi matin, nos managers étaient déjà en cellule de crise.
De notre côté, en tant qu'analystes, l'objectif était simple à formuler et beaucoup moins simple à tenir : garder une vision sur la détection.

Voici ce que nous avions devant nous en début de matinée :

- la console **Defender** ne chargeait plus, puis seulement par moments, de façon très lente et buggée
- le portail **Azure** était lent mais restait utilisable
- **Outlook** était inaccessible
- **Teams** fonctionnait et devenait de fait notre seul canal d'échange avec le client
- **plus aucune alerte** ne remontait dans le SOAR

Pour couronner le tout, le peu que nous arrivions à charger dans Defender ne donnait pas les mêmes informations entre mes collègues et moi. Même console et même tenant mais des résultats différents....

Lorsqu'un outil est indisponible, on le constate et on s'organise. Mais dans le cas d'un outil qui répond à moitié et différemment selon qui le regarde, cela ne permet plus de se fier à rien.

Il restait une question : cette absence d'alertes était-elle normale ? Matinée calme ou chaîne de détection cassée quelque part ?
Vues depuis notre poste les deux situations se ressemblent parfaitement : un écran vide.

## Première piste : vérifier la chaîne avec KQL

En fin de matinée MDE a fini par charger un peu. La navigation restait pénible mais suffisante pour agir, nous avons alors lancé des requêtes **KQL** manuelles pour déclencher un batch de détections MDE avec un objectif précis : vérifier qu'elles partaient bien jusqu'au SOAR.

Et elles sont arrivées ! La remontée MDE --> SOAR fonctionnait donc.
Ce test ne disait pas tout mais il éliminait une hypothèse importante et nous rassurait sur une partie de la chaîne.

## Deuxième piste : trouver un autre point de vue

Nous voulions ensuite recouper avec une source indépendante. Le réflexe était de passer par Sentinel côté Azure, puisque Azure tenait à peu près le coup. Malheureusement pour nous la partie Sentinel d'Azure a été entièrement fusionnée par Microsoft dans le portail Defender depuis quelques semaines et plus rien côté Azure ne fonctionnait sans renvoyer vers MDE..... impossible donc de s'en servir comme second regard.

Il nous restait une source de détection indépendante de Microsoft. L'exploiter en dehors de notre chaîne habituelle demandait beaucoup plus de travail manuel. C'était fastidieux mais cela nous a permis de garder un œil ouvert pendant que le reste était dans le brouillard.

## Teams, le dernier fil avec le client

Avec Outlook hors service, tout passait par Teams pour tenir le client au courant de la situation sur les détections.
Alors que les réseaux sociaux évoquaient des attaquants prêts à profiter de la panne, le niveau de tension était très élevé. Il était donc de notre devoir de montrer que le SOC restait sur le qui-vive avec une vision dégradée mais fonctionnelle tout de même.

## Le retour progressif et une surprise dans l'après-midi

Microsoft a rétabli la situation petit à petit, nous avons récupéré les mails en début d'après-midi puis Defender un peu plus tard.

La petite surprise : aucune alerte de la matinée n'est arrivée en retard.

## Alors, aveugles ou pas ?

Avec le recul, l'explication la plus probable de ce silence est assez simple : presque personne ne travaillait.
Une grande partie des détections naît de l'activité quotidienne des utilisateurs. Or ce vendredi une bonne partie du monde professionnel était à l'arrêt.

Sur les réseaux beaucoup affichaient un « Microsoft est down, c'est le week-end ». Le décalage horaire a joué aussi : les zones Amérique et Asie dormaient pendant notre matinée et n'ont commencé leur journée qu'en milieu d'après-midi heure française, quasiment au moment où les services revenaient. Elles n'ont donc pratiquement pas vécu cette crise.
Moins d'activité et donc moins de détections : notre écran vide était "probablement" normal finalement.

Mais cette conclusion ne pouvait pas être tirée avant d'avoir été vérifiée, supposer que tout allait bien sur un client encore marqué par un incident majeur n'était tout simplement pas envisageable.

Pendant que beaucoup de monde s'arrêtait, notre équipe a travaillé sans interruption de 8h à 18h avec un rythme particulièrement intense jusqu'au retour de Defender dans l'après-midi.

## Ce que j'en retiens

### Être aveugle n'est pas une option

C'est le point le plus important de ce retour d'expérience, même avec une partie de nos outils chez Microsoft, notre travail ce jour-là a consisté à trouver des moyens détournés pour garder une vue (une sorte de "système D" finalement) : forcer des détections en KQL, basculer sur une source de détection indépendante et l'exploiter à la main.

Le but était double : continuer à détecter et rassurer notre client sur le fait que son SOC restait utile et vigilant même pendant une crise mondiale majeure.

Pour moi c'est la plus belle qualité qu'un SOC puisse avoir.

### Un silence doit s'expliquer et non se supposer

Au final notre silence avait, semble-t-il, une explication logique. Mais tant que nous ne l'avions pas vérifié il pouvait tout aussi bien signifier une chaîne de détection en panne. Une absence totale d'alertes doit être traitée comme un événement à part entière et non comme une bonne nouvelle.

### Diversifier ses sources de détection

Notre source de détection indépendante de Microsoft a été notre seul regard extérieur de la journée. Quand toute la détection repose sur un seul éditeur, une panne de cet éditeur devient un point de défaillance unique pour la sécurité.
Avoir au moins une source qui ne dépend pas du même écosystème change complètement la donne et sauve un SOC de l'aveuglement complet.

### Comparer ce que chacun voit

Le décalage entre mon écran et celui de mes collègues est apparu parce que nous avons comparé nos vues.
Quand les outils sont instables, plusieurs analystes qui partagent ce qu'ils voient valent mieux que plusieurs analystes qui travaillent chacun dans leur coin.

### Le contexte change tout

Avec des campagnes de phishing qui exploitaient déjà l'incident chaque minute sans visibilité pesait lourd.
Tenir le client informé, dire ce que l'on sait et ce que l'on ne sait pas fait partie du travail d'un SOC au même titre que la détection.

## Conclusion

Cette journée s’est bien terminée : pas d’incident de sécurité et des services rétablis dans l’après-midi.
Elle m’a pourtant appris une chose : les outils donnent la vue à un SOC mais c’est à l’équipe de la garder quand ils tombent. Dans ces moments-là la compétence la plus utile n’est pas de lire une alerte mais de remarquer qu’il n’y en a plus, de comprendre pourquoi et de trouver un autre moyen de voir.

Quand elles flanchent la compétence la plus utile n'est pas de lire les alertes, mais de remarquer qu'il n'y en a plus, de comprendre pourquoi et de trouver un autre moyen de continuer à les voir.

## Sources

- [Microsoft sur X : message d'excuses et précisions sur la cause](https://x.com/Microsoft/status/2121282013600907325)
- [Numerama : une panne géante frappe Microsoft, Outlook, Teams et Microsoft 365 inaccessibles](https://www.numerama.com/tech/2373485-une-panne-geante-frappe-microsoft-outlook-teams-et-microsoft-365-inaccessibles-voici-ce-que-lon-sait.html)
- [Numerama : retour au fax et paiements bloqués, la pagaille provoquée par la panne](https://www.numerama.com/cyberguerre/2373867-retour-au-fax-pas-de-cinema-paiements-en-ligne-bloques-la-panne-de-microsoft-engendre-une-pagaille-en-france-et-dans-le-monde.html)
- [Numerama : le journal de bord de Microsoft pendant la panne](https://www.numerama.com/tech/2374177-les-mesures-prises-nont-pas-apporte-le-soulagement-attendu-le-journal-de-bord-de-microsoft-revele-ses-tatonnements-pendant-sa-panne-geante.html)
- [Page d'état des services Microsoft 365](https://status.cloud.microsoft)
