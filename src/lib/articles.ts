// Classement des articles : une catégorie (liste fermée) et des tags (libres, mais d'écriture unique)

/** Catégories : une seule par article. La même liste figure dans le formulaire d'issue (.github/ISSUE_TEMPLATE/article.yaml). */
export const CATEGORIES = {
  offensif: 'Offensif',
  defensif: 'Défensif',
  gouvernance: 'Gouvernance',
} as const;
export type Category = keyof typeof CATEGORIES;

// Tags qui veulent dire la même chose (français/anglais, variantes) : à gauche l'écriture rencontrée, à droite celle qu'on garde.
// À compléter quand un doublon apparaît : les articles concernés sont regroupés au build suivant, sans les modifier.
const TAG_ALIASES: Record<string, string> = {
  forensique: 'forensic',
  forensics: 'forensic',
  'retour-d-experience': 'retex',
  rex: 'retex',
  blueteam: 'blue-team',
  redteam: 'red-team',
  'reverse-engineering': 'reverse',
  'retro-ingenierie': 'reverse',
};

/** Écriture unique d'un tag : minuscules, sans accent, tirets. « SOC », « Soc » et « soc » donnent « soc ». */
export const normalizeTag = (tag: string) => {
  const slug = tag
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\+/g, 'p') // c++ → cpp
    .replace(/#/g, 'sharp') // c# → csharp
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return TAG_ALIASES[slug] ?? slug;
};

// Vérification à chaque build
console.assert(
  normalizeTag(' SOC ') === 'soc' && normalizeTag('Rétro-ingénierie') === 'reverse' && normalizeTag('C++') === 'cpp',
  'normalizeTag',
);
