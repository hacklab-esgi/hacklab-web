// Sommaire « serpent » : un tracé SVG suit les retraits des titres.
// Le violet couvre ce qui est à l'écran, du haut au bas de la fenêtre, et avance en continu.
// La boule est la tête du serpent : en bas quand on descend, en haut quand on remonte.

const LINE_X = 4; // position du trait au niveau 0, en px
const STEP = 12; // décalage du trait par niveau, en px (même pas que le retrait du texte)
const SLANT = 8; // hauteur du biais entre deux niveaux
const READING_LINE = 0.25; // ligne de lecture : au quart haut de la zone visible
const THUMB = 7; // diamètre de la boule

export function initToc(root: HTMLDetailsElement) {
  const body = root.querySelector<HTMLElement>('.toc-body')!;
  const list = body.querySelector('ol')!;
  const items = [...list.querySelectorAll<HTMLLIElement>('li')];
  const links = items.map((li) => li.querySelector('a')!);
  const headings = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));
  const paths = body.querySelectorAll<SVGPathElement>('path');
  const svgs = body.querySelectorAll<SVGSVGElement>('svg');
  const progress = body.querySelector<HTMLElement>('.toc-progress')!;
  const thumb = body.querySelector<HTMLElement>('.toc-thumb')!;

  let geo: { x: number; prevX: number; top: number; bottom: number }[] = [];
  let height = 0;

  // Abscisse du tracé à une hauteur donnée (dans le biais, interpolée entre les deux niveaux)
  const xAt = (y: number) => {
    const g = geo.find((it) => y <= it.bottom) ?? geo[geo.length - 1];
    if (g.prevX === g.x || y >= g.top + SLANT) return g.x;
    const t = Math.max(0, (y - g.top) / SLANT);
    return g.prevX + (g.x - g.prevX) * t;
  };

  const layout = () => {
    geo = items.map((li, i) => {
      const x = LINE_X + Number(li.dataset.level ?? 0) * STEP;
      const prevX = i > 0 ? LINE_X + Number(items[i - 1].dataset.level ?? 0) * STEP : x;
      return { x, prevX, top: li.offsetTop, bottom: li.offsetTop + li.offsetHeight };
    });
    if (!geo.length) return;
    height = list.offsetHeight;
    let d = `M${geo[0].x} ${geo[0].top}`;
    for (const g of geo) {
      d += g.prevX !== g.x ? ` L${g.x} ${g.top + SLANT}` : ` L${g.x} ${g.top}`;
      d += ` L${g.x} ${g.bottom}`;
    }
    const width = Math.max(...geo.map((g) => g.x)) + THUMB;
    svgs.forEach((svg) => {
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
    });
    paths.forEach((p) => p.setAttribute('d', d));
    update();
  };

  let lastScroll = window.scrollY;
  let direction: 'down' | 'up' = 'down';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Position dans le sommaire d'une hauteur de l'écran : section qui la contient + avancement dans cette section
  const positionOf = (yView: number, starts: number[], articleEnd: number) => {
    let i = -1;
    starts.forEach((top, k) => {
      if (top <= yView) i = k;
    });
    if (i === -1) return { i, y: geo[0].top };
    const end = starts[i + 1] ?? articleEnd;
    const ratio = Math.min(1, Math.max(0, (yView - starts[i]) / Math.max(1, end - starts[i])));
    return { i, y: geo[i].top + (geo[i].bottom - geo[i].top) * ratio };
  };

  const update = () => {
    if (!geo.length) return;
    const navBottom = document.querySelector('nav')?.getBoundingClientRect().bottom ?? 0;
    const viewBottom = window.innerHeight;
    const articleEnd = document.querySelector('article')?.getBoundingClientRect().bottom ?? viewBottom;
    const starts = headings.map((h) => h?.getBoundingClientRect().top ?? Infinity);

    // Le violet couvre tout l'écran, du haut (sous la navbar) au bas : la queue reste bien visible.
    // La section lue (en gras) est celle qui a passé la ligne de lecture.
    const top = positionOf(navBottom + 1, starts, articleEnd);
    const bottom = positionOf(viewBottom - 1, starts, articleEnd);
    const reading = positionOf(navBottom + (viewBottom - navBottom) * READING_LINE, starts, articleEnd);
    const y1 = Math.max(top.y, bottom.y);

    progress.style.clipPath = `inset(${top.y}px 0 ${height - y1}px 0)`;

    // La boule est la tête du serpent : en bas quand on descend, en haut quand on remonte
    const head = direction === 'down' ? y1 : top.y;
    const ty = Math.min(height - THUMB, Math.max(0, head - THUMB / 2));
    thumb.style.transform = `translate(${xAt(head) - THUMB / 2}px, ${ty}px)`;

    links.forEach((a, i) => {
      a.classList.toggle('current', i === reading.i);
      a.classList.toggle('active', i !== reading.i && i >= top.i && i <= bottom.i);
    });

    // Sommaire plus long que sa colonne : garder la tête en vue
    if (body.scrollHeight > body.clientHeight) {
      if (head < body.scrollTop + 24 || head > body.scrollTop + body.clientHeight - 48) {
        body.scrollTop = head - body.clientHeight * (direction === 'down' ? 0.7 : 0.3);
      }
    }
  };

  // Suivi image par image : la boule est collée au défilement, sans retard d'animation
  let frame = 0;
  let flipTimer = 0;
  const schedule = () => {
    const y = window.scrollY;
    if (y !== lastScroll) {
      const next = y > lastScroll ? 'down' : 'up';
      // Changement de sens : la boule glisse vers l'autre bout au lieu de sauter
      if (next !== direction && !reduceMotion.matches) {
        thumb.classList.add('is-flipping');
        clearTimeout(flipTimer);
        flipTimer = window.setTimeout(() => thumb.classList.remove('is-flipping'), 260);
      }
      direction = next;
      lastScroll = y;
    }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', layout);
  root.addEventListener('toggle', layout);
  document.fonts?.ready.then(layout);
  layout();
}
