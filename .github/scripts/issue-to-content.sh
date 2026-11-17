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
  article) TITLE_LABEL="Titre de l'Article"; DIR=src/content/posts; NAME="d’article" ;;
  projet)  TITLE_LABEL="Titre du projet";    DIR=src/content/projects; NAME="de projet" ;;
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
else
  git checkout -q -b "$BRANCH"
fi
# Titre modifié = nouveau nom de fichier : l'ancien fichier de cette proposition est retiré
git diff --name-only --diff-filter=A origin/master...HEAD -- "$DIR" | xargs -r git rm -q --

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
  # Brouillon : rien n'est publié tant qu'un relecteur n'a pas passé « draft » à false
  echo "draft: true"
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
  git push -q origin "$BRANCH"
fi

PR_BODY="Proposition envoyée depuis l’issue #$ISSUE, à relire avant publication.

- Le fichier est en brouillon (\`draft: true\`) : passer à \`false\` pour publier.
- Si l’auteur modifie son issue, cette pull request se met à jour toute seule."
if [ -n "$NEW_TAGS" ]; then
  PR_BODY="$PR_BODY
- **Nouveaux tags** (jamais utilisés) : $(printf '%s' "$NEW_TAGS" | sed 's/.*/\`&\`/' | paste -sd, - | sed 's/,/, /g'). Vérifier qu’ils ne doublonnent pas un tag existant : $(printf '%s' "$KNOWN" | sed 's/.*/\`&\`/' | paste -sd, - | sed 's/,/, /g'). Pour fusionner deux écritures, compléter \`TAG_ALIASES\` dans \`src/lib/articles.ts\`."
fi
PR_BODY="$PR_BODY

Closes #$ISSUE"

PR_URL=$(gh pr list --head "$BRANCH" --state open --json url --jq '.[0].url // empty')
if [ -z "$PR_URL" ]; then
  PR_URL=$(gh pr create --base master --head "$BRANCH" --title "📝 Proposition $NAME : $TITLE" --body "$PR_BODY")
else
  gh pr edit "$PR_URL" --title "📝 Proposition $NAME : $TITLE" --body "$PR_BODY" > /dev/null
fi

printf '✅ **Proposition bien reçue, merci !**\n\nElle est en relecture ici : %s\n\nPour corriger ou compléter votre texte, modifiez simplement cette issue : la pull request se mettra à jour toute seule.\n' "$PR_URL" > "$MSG"
echo "✅ $FILE → $PR_URL"
