// Brouillons (« draft: true ») : cachés sur le site, visibles dans les aperçus Netlify des pull requests
// (Netlify y définit CONTEXT=deploy-preview). Le relecteur voit la proposition telle qu'elle s'affichera,
// sans avoir à la publier. Fichier lu au build uniquement (process.env n'existe pas dans le navigateur).
const PREVIEW = process.env.CONTEXT === 'deploy-preview';

export const isVisible = (entry: { data: { draft?: boolean } }) => PREVIEW || !entry.data.draft;
