// Sommaire des articles : replié sur mobile (une colonne), ouvert sur desktop.
// Chargé juste après le sommaire, avant l'affichage, pour éviter tout clignotement.
document.querySelectorAll('[data-toc]').forEach((el) => {
  el.open = !window.matchMedia('(max-width: 1380px)').matches;
});
