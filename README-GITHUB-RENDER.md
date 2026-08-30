# IDRARIUM-ANARCHY — GitHub Pages + Render

Cette version sépare le site statique et le backend.

## PARTIE A — GitHub Pages

1. Crée un dépôt GitHub, par exemple `idrarium-shop`.
2. Mets le contenu du dossier `github-pages/` à la racine du dépôt.
3. Dans `Settings > Pages`, choisis `Deploy from a branch`, branche `main`, dossier `/ (root)`.
4. Attends le déploiement.
5. Ouvre ton site GitHub Pages.
6. Dans `index.html`, remplace :
   `https://TON-BACKEND.onrender.com`
   par l'URL de ton backend Render.

Ne mets jamais de mot de passe RCON ni de secret Lootably dans GitHub.

## PARTIE B — Render (backend)

1. Crée un compte Render.
2. `New > Web Service`.
3. Connecte le dépôt GitHub contenant le dossier `backend`.
4. Si ton dépôt contient seulement le backend, laisse le root normal.
   Si tu utilises ce ZIP tel quel dans un mono-repo, configure le Root Directory sur `backend`.
5. Build command : `npm install`
6. Start command : `npm start`
7. Ajoute les variables d'environnement de `.env.example` dans Render.

Variables :
- `FRONTEND_ORIGIN=https://TONUTILISATEUR.github.io`
- `LOOTABLY_POSTBACK_SECRET=...`
- `LOOTABLY_PLACEMENT_ID=...`
- `MC_RCON_HOST=...`
- `MC_RCON_PORT=25575`
- `MC_RCON_PASSWORD=...`
- `VIP_DURATION=1d`

## IMPORTANT : RCON

Le backend Render doit pouvoir joindre le RCON de ton serveur Minecraft.
Si ton serveur Minecraft est chez MCServerHost et que RCON n'est pas publiquement accessible ou autorisé, ce montage ne pourra pas envoyer la commande directement.

Dans ce cas, il faut utiliser une passerelle/API côté hébergeur Minecraft, un plugin qui expose une API HTTPS sécurisée, ou un petit agent placé côté serveur.

N'expose jamais RCON directement à toute l'Internet sans contrôle d'accès.

## PARTIE C — Lootably

Crée ton Publisher account/Placement puis configure un postback vers :

`https://TON-BACKEND.onrender.com/api/lootably/postback?userID={userID}&ip={ip}&revenue={revenue}&currencyReward={currencyReward}&hash={hash}`

Le pseudo Minecraft doit être envoyé comme `userID`.

Le backend vérifie le hash avant de compter la conversion.

## Ce que fait le système

Conversion validée -> +1
5 conversions -> exécute :
`lp user PSEUDO parent addtemp vip 1d`
puis remet la progression à 0.

Ce n'est pas forcément "5 vidéos" : selon le provider, une conversion peut être une offre autre qu'une vidéo.
