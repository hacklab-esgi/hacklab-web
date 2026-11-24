#!/usr/bin/env bash
# Transforme une issue « Proposer un article » ou « Publication d'un projet » en fichier de contenu + pull request.
#
# Entrées (variables d'environnement fournies par le workflow) :
#   KIND (article | projet), ISSUE (numéro), ISSUE_BODY, CREATED_AT, GH_TOKEN
# Le message écrit dans $MSG est publié en commentaire sur l'issue : l'auteur sait si sa proposition
# est passée, ou ce qu'il doit corriger. Modifier l'issue relance tout et met la pull request à jour.
#
# Sécurité : le contenu de l'issue n'est jamais interprété par le shell (variables entre guillemets, jq pour
# le frontmatter). Il est publié en .md, sans exécution de code au build, et nettoyé par rehype-sanitize.
# Images : seules les pièces jointes hébergées par GitHub sont téléchargées, et seul un vrai fichier image est gardé.
set -euo pipefail

TMP="${RUNNER_TEMP:-/tmp}"
MSG="$TMP/message.md"
BODY="$TMP/issue_body.txt"
rm -f "$MSG"

fail() {
  printf '❌ **La proposition n’a pas pu être prise en compte.**\n\n%s\n\nPour corriger : modifiez cette issue (menu « … » en haut à droite de votre message, puis « Edit »). La vérification se relance toute seule.\n' "$1" > "$MSG"
  echo "❌ $1" >&2
  exit 1
}

case "$KIND" in
  article) TITLE_LABEL="Titre de l'Article"; DIR=src/content/posts; NAME="d’article"; SECTION=blog ;;
  projet)  TITLE_LABEL="Titre du projet";    DIR=src/content/projects; NAME="de projet"; SECTION=projects ;;
  *) fail "Type de proposition inconnu." ;;
esac

printf '%s\n' "$ISSUE_BODY" | tr -d '\r' > "$BODY"

# Le contenu peut lui-même contenir des titres « ### » : il s'étend du champ « Contenu complet »
# jusqu'au DERNIER « ### Auteur » de l'issue (celui du formulaire).
start=$(grep -n -m1 '^### Contenu complet' "$BODY" | cut -d: -f1 || true)
end=$(grep -n '^### Auteur[[:space:]]*$' "$BODY" | tail -1 | cut -d: -f1 || true)
if [ -z "$start" ] || [ -z "$end" ] || [ "$end" -le "$start" ]; then
  fail "Le formulaire semble incomplet : les rubriques « Contenu complet » et « Auteur » sont introuvables. Merci de ne pas supprimer les titres « ### » du formulaire."
fi
head -n "$((start - 1))" "$BODY" > "$BODY.head"
sed -n "$((start + 1)),$((end - 1))p" "$BODY" > "$BODY.content"
tail -n "+$end" "$BODY" > "$BODY.tail"

# Valeur d'un champ : les lignes sous son titre, réunies en une seule, espaces superflus retirés.
# (Pas de xargs : il supprimait les apostrophes et plantait quand il y en avait un nombre impair.)
field() { # field <fichier> <titre du champ>
  awk -v h="### $2" 'index($0, h) == 1 {f = 1; next} f && /^### / {exit} f' "$1" | tr '\n' ' ' \
    | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//; s/^_No response_$//'
}
# Chaîne JSON = chaîne YAML valide : impossible d'injecter des clés dans le frontmatter
q() { printf '%s' "$1" | jq -Rs .; }
slugify() { { iconv -f utf-8 -t ascii//TRANSLIT 2>/dev/null || true; } | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-//; s/-$//'; }

TITLE=$(field "$BODY.head" "$TITLE_LABEL")
DESCRIPTION=$(field "$BODY.head" "Description")
AUTHOR=$(field "$BODY.tail" "Auteur")
CONTENT=$(sed '/./,$!d' "$BODY.content")

[ -n "$TITLE" ] || fail "Le champ **Titre** est vide."
[ -n "$DESCRIPTION" ] || fail "Le champ **Description** est vide."
[ -n "$CONTENT" ] || fail "Le champ **Contenu complet** est vide."
[ -n "$AUTHOR" ] || fail "Le champ **Auteur** est vide."

NEW_TAGS=""
if [ "$KIND" = article ]; then
  # Catégorie : liste fermée, la même que dans src/lib/articles.ts
  CATEGORY=$(field "$BODY.head" "Catégorie" | slugify)
  case "$CATEGORY" in
    offensif | defensif | gouvernance) ;;
    *) fail "La **catégorie** est absente ou inconnue. Ajoutez, juste après le titre de l’article, une rubrique \`### Catégorie\` suivie d’une ligne vide puis de \`Offensif\`, \`Défensif\` ou \`Gouvernance\`." ;;
  esac
  # Tags : même écriture pour tous (minuscules, sans accent, tirets), sans doublon
  TAGS=$(field "$BODY.tail" "Tags" | tr ',' '\n' | while IFS= read -r tag || [ -n "$tag" ]; do printf '%s' "$tag" | slugify; echo; done | awk 'NF && !seen[$0]++')
  [ -n "$TAGS" ] || fail "Le champ **Tags** est vide."
  # Tags jamais utilisés par un article publié : signalés au relecteur, pour éviter deux tags pour la même idée
  KNOWN=$(git ls-tree -r --name-only origin/master -- "$DIR" | while IFS= read -r f; do
    git show "origin/master:$f" | awk '/^---/ {n++; next} n == 1 && /^tags:/ {t = 1; next} n == 1 && t && /^[[:space:]]*-/ {sub(/^[[:space:]]*-[[:space:]]*/, ""); gsub(/"/, ""); print; next} {t = 0} n >= 2 {exit}'
  done | while IFS= read -r tag || [ -n "$tag" ]; do printf '%s' "$tag" | slugify; echo; done | sort -u)
  NEW_TAGS=$(comm -23 <(printf '%s\n' "$TAGS" | sort -u) <(printf '%s\n' "$KNOWN"))
else
  LINK=$(field "$BODY.tail" "Lien github")
  [[ "$LINK" =~ ^https://[^[:space:]]+$ ]] || fail "Le champ **Lien github du projet** doit être une adresse complète, par exemple \`https://github.com/hacklab-esgi/mon-projet\`."
fi

SLUG=$(printf '%s' "$TITLE" | slugify)
[ -n "$SLUG" ] || SLUG="proposition-$ISSUE"
FILE="$DIR/$SLUG.md"
BRANCH="$KIND-issue-$ISSUE"
DATE="${CREATED_AT%%T*}"

if git ls-tree -r --name-only origin/master -- "$DIR" | grep -qE "/$SLUG\.mdx?$"; then
  fail "Un contenu publié porte déjà ce titre. Merci d’en choisir un autre."
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# La branche existe déjà si l'issue a été modifiée : on ajoute un commit par-dessus,
# les retouches faites en relecture restent dans l'historique.
if git fetch -q origin "$BRANCH" 2>/dev/null; then
  git checkout -q -B "$BRANCH" FETCH_HEAD
  # La branche suit master : l'aperçu de la proposition est construit avec le code actuel du site.
  # En cas de conflit (retouche de relecture sur un fichier modifié depuis), on continue sans cette mise à niveau.
  git merge -q --no-edit origin/master || git merge --abort
else
  git checkout -q -b "$BRANCH"
fi
# Titre modifié = nouveau nom de fichier : les anciens fichiers de cette proposition (texte et images) sont retirés
git diff -z --name-only --diff-filter=A origin/master...HEAD -- "$DIR" | xargs -0 -r git rm -q --

# Images glissées dans le formulaire : GitHub les héberge. Elles sont copiées dans le dépôt, à côté du texte,
# pour ne plus dépendre de GitHub et être optimisées au build. Une balise <img> de GitHub devient une image
# Markdown, la seule forme qu'Astro optimise.
GITHUB_IMAGE='https://github\.com/user-attachments/assets/[0-9a-fA-F-]+|https://user-images\.githubusercontent\.com/[0-9]+/[A-Za-z0-9._-]+|https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/assets/[0-9]+/[0-9a-fA-F-]+'
IMAGES=0
while IFS= read -r url; do
  IMAGES=$((IMAGES + 1))
  [ "$IMAGES" -le 20 ] || fail "La proposition contient plus de 20 images. Merci d’en retirer."
  curl -fsSL --proto '=https' --proto-redir '=https' --max-time 60 --max-filesize 5000000 -o "$TMP/image" "$url" \
    && [ "$(stat -c %s "$TMP/image")" -le 5000000 ] \
    || fail "L’image n° $IMAGES n’a pas pu être récupérée ou dépasse 5 Mo. Merci de la réduire puis de la glisser à nouveau dans le formulaire."
  case "$(file --mime-type -b "$TMP/image")" in
    image/png) ext=png ;;
    image/jpeg) ext=jpg ;;
    image/gif) ext=gif ;;
    image/webp) ext=webp ;;
    *) fail "Le fichier joint n° $IMAGES n’est pas une image acceptée (PNG, JPEG, GIF ou WebP)." ;;
  esac
  mkdir -p "$DIR/$SLUG"
  mv "$TMP/image" "$DIR/$SLUG/$IMAGES.$ext"
  rel="./$SLUG/$IMAGES.$ext"
  sed -E -i "s#<img[^>]*alt=\"([^\"]*)\"[^>]*src=\"$url\"[^>]*>#![\\1]($rel)#g; s#<img[^>]*src=\"$url\"[^>]*alt=\"([^\"]*)\"[^>]*>#![\\1]($rel)#g; s#<img[^>]*src=\"$url\"[^>]*>#![]($rel)#g; s#$url#$rel#g" "$BODY.content"
done < <(grep -oE "$GITHUB_IMAGE" "$BODY.content" | awk '!seen[$0]++')

# Toute autre image doit avoir une adresse complète en https : un chemin relatif ferait échouer la mise en ligne
# du site. Les blocs de code et le code en ligne ne sont pas regardés (un article peut citer « <img src=x> »).
# ponytail: les images « par référence » (![texte][ref]) et les blocs de code indentés ne sont pas reconnus ;
# passer à un vrai analyseur Markdown si le cas se présente.
BAD_IMAGES=$(awk '/^[[:space:]]*(```|~~~)/ {code = !code; next} !code' "$BODY.content" | sed 's/`[^`]*`//g' \
  | grep -oE '!\[[^]]*\]\([^)[:space:]]+|<img[^>]*src="[^"]*"' | sed -E 's/^!\[[^]]*\]\(//; s/^<img[^>]*src="//; s/"$//' \
  | grep -vE "^(https://|\./$SLUG/[0-9]+\.[a-z]+\$)" | head -3 | paste -sd ' ' - | tr -d '`' | cut -c1-200 || true)
[ -z "$BAD_IMAGES" ] || fail "Ces images ne peuvent pas être affichées : \`$BAD_IMAGES\`. Glissez le fichier dans le champ « Contenu complet » (GitHub l’héberge, il sera copié sur le site), ou donnez une adresse complète en \`https://\`."
CONTENT=$(sed '/./,$!d' "$BODY.content")

mkdir -p "$DIR"
{
  echo "---"
  echo "title: $(q "$TITLE")"
  echo "description: $(q "$DESCRIPTION")"
  if [ "$KIND" = article ]; then
    echo "createdAt: $DATE"
    echo "category: $CATEGORY"
    echo "tags:"
    printf '%s\n' "$TAGS" | sed 's/^/  - /'
  else
    echo "date: $DATE"
    echo "info:"
    echo "  - text: GitHub"
    echo "    link: $(q "$LINK")"
    echo "    icon:"
    echo "      type: lucide"
    echo "      name: github"
  fi
  # Pas de « draft » : la relecture se fait dans la pull request et son aperçu, la fusionner publie la page
  echo "author: $(q "$AUTHOR")"
  echo "---"
  echo
  printf '%s\n' "$CONTENT"
} > "$FILE"

git add -A -- "$DIR"
if git diff --cached --quiet; then
  echo "Aucun changement par rapport à la proposition précédente."
else
  git commit -q -m "📝 Proposition $NAME : $TITLE"
fi
# Envoi dans tous les cas : même sans changement de texte, la branche peut avoir été remise à niveau avec master
git push -q origin "$BRANCH"

PR_BODY="Proposition envoyée depuis l’issue #$ISSUE, à relire avant publication.

- **Fusionner cette pull request publie la page sur le site.** Tant qu’elle n’est pas fusionnée, la page n’existe que dans l’aperçu.
- Si l’auteur modifie son issue, cette pull request se met à jour toute seule."
if [ "$IMAGES" -gt 0 ]; then
  PR_BODY="$PR_BODY
- $IMAGES image(s) copiée(s) depuis l’issue dans \`$DIR/$SLUG/\` : vérifier qu’elles s’affichent dans l’aperçu."
fi
if [ -n "$NEW_TAGS" ]; then
  PR_BODY="$PR_BODY
- **Nouveaux tags** (jamais utilisés) : $(printf '%s' "$NEW_TAGS" | sed 's/.*/\`&\`/' | paste -sd, - | sed 's/,/, /g'). Vérifier qu’ils ne doublonnent pas un tag existant : $(printf '%s' "$KNOWN" | sed 's/.*/\`&\`/' | paste -sd, - | sed 's/,/, /g'). Pour fusionner deux écritures, compléter \`TAG_ALIASES\` dans \`src/lib/articles.ts\`."
fi
PR_BODY="$PR_BODY

Closes #$ISSUE"

# À ce stade le texte est déjà sur la branche. Si GitHub refuse la pull request (réglage du dépôt, panne),
# on le dit à l'auteur et à l'équipe, avec le message de GitHub, au lieu d'une « erreur inattendue ».
pr_failed() {
  cat "$TMP/gh_error.txt" >&2
  printf '⏳ **Votre proposition est bien enregistrée, mais la pull request n’a pas pu être créée.** Vous n’avez rien à refaire.\n\nÀ l’équipe du HackLab : vérifier dans Settings > Actions > General que « Allow GitHub Actions to create and approve pull requests » est coché, puis modifier cette issue pour relancer. Le texte attend sur la branche `%s`.\n\nMessage de GitHub : `%s`\n' \
    "$BRANCH" "$(tr '\n`' " '" < "$TMP/gh_error.txt" | cut -c1-300)" > "$MSG"
  exit 1
}
PR_TITLE="📝 Proposition $NAME : $TITLE"
PR_URL=$(gh pr list --head "$BRANCH" --state open --json url --jq '.[0].url // empty' 2> "$TMP/gh_error.txt") || pr_failed
if [ -z "$PR_URL" ]; then
  PR_URL=$(gh pr create --base master --head "$BRANCH" --title "$PR_TITLE" --body "$PR_BODY" 2> "$TMP/gh_error.txt") || pr_failed
fi
# Le numéro de la pull request donne l'adresse de son aperçu Netlify : le relecteur ouvre la page telle qu'elle
# sera publiée. « hacklabesgi » est le nom du site Netlify.
PREVIEW="https://deploy-preview-${PR_URL##*/}--hacklabesgi.netlify.app/$SECTION/$SLUG/"
gh pr edit "$PR_URL" --title "$PR_TITLE" --body "**Aperçu de la page** (une fois le déploiement approuvé dans Netlify) : $PREVIEW

$PR_BODY" > /dev/null 2> "$TMP/gh_error.txt" || pr_failed

printf '✅ **Proposition bien reçue, merci !**\n\nElle est en relecture ici : %s\n\nPour corriger ou compléter votre texte, modifiez simplement cette issue : la pull request se mettra à jour toute seule.\n' "$PR_URL" > "$MSG"
echo "✅ $FILE → $PR_URL"
