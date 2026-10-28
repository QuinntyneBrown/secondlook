// Slide runtime for docs/videos (creating-videos skill). Shows one <section> at a
// time; ?slide=N (1-based) or #N picks it, so the builder can screenshot each.
// Arrow keys and Space step through when presenting. Draws the header label and
// progress bar from <body data-parts>, and expands progressive builds:
// <section data-template="id" data-show="3"> reveals the first 3 items,
// data-highlight="2-4" dims all but those.
(function () {
  const body = document.body;
  const parts = (body.dataset.parts || '').split('|');
  const total = parts.length;
  const sections = Array.from(document.querySelectorAll('body > section'));

  const range = (spec) => {
    const out = new Set();
    for (const piece of String(spec).split(',')) {
      const [a, b] = piece.split('-').map(Number);
      for (let i = a; i <= (b || a); i++) out.add(i);
    }
    return out;
  };

  // <pre class="code" data-mark="2,5-7"> highlights those lines.
  document.querySelectorAll('pre.code[data-mark]').forEach((pre) => {
    const keep = range(pre.dataset.mark);
    pre.innerHTML = pre.innerHTML
      .split('\n')
      .map((line, i) => (keep.has(i + 1) ? `<span class="mark">${line}</span>` : line))
      .join('\n');
  });

  sections.forEach((section) => {
    const id = section.dataset.template;
    if (id) {
      const template = document.getElementById(id);
      section.appendChild(template.content.cloneNode(true));
      const items = Array.from(section.querySelectorAll('.item'));
      if (section.dataset.show) items.forEach((item, i) => item.classList.toggle('hidden', i >= Number(section.dataset.show)));
      if (section.dataset.highlight) {
        const keep = range(section.dataset.highlight);
        items.forEach((item, i) => item.classList.toggle('dim', !keep.has(i + 1)));
      }
    }
    const part = Number(section.dataset.part || 0);
    const header = document.createElement('div');
    header.className = 'slide-header';
    const assets = document.querySelector('link[href$="slides.css"]').getAttribute('href').replace('slides.css', '');
    header.innerHTML = '<img alt="" src="' + assets + 'mark.svg"><span></span><span class="part"></span>';
    header.children[1].textContent = `SecondLook · Video ${body.dataset.videoNumber} · ${body.dataset.videoTitle}`;
    header.children[2].textContent = parts[part] || '';
    section.prepend(header);
    const bar = document.createElement('div');
    bar.className = 'slide-progress';
    bar.style.width = `${((part + 1) / total) * 100}%`;
    section.appendChild(bar);
    // Clips are overlaid by the builder; in a browser they play in place.
    const video = section.querySelector('video.clip');
    if (video && section.dataset.clip && !video.getAttribute('src')) {
      video.src = section.dataset.clip;
      video.muted = true;
      video.playsInline = true;
    }
  });

  let current = 0;
  const show = (n) => {
    current = Math.max(0, Math.min(sections.length - 1, n));
    sections.forEach((s, i) => s.classList.toggle('active', i === current));
    const video = sections[current].querySelector('video.clip');
    if (video && !document.documentElement.dataset.render) {
      video.currentTime = 0;
      void video.play().catch(() => {});
    }
  };
  const params = new URLSearchParams(location.search);
  if (params.has('render')) document.documentElement.dataset.render = '1';
  show(Number(params.get('slide') || location.hash.slice(1) || 1) - 1);
  addEventListener('hashchange', () => show(Number(location.hash.slice(1) || 1) - 1));
  addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) show(current + 1);
    if (['ArrowLeft', 'PageUp'].includes(e.key)) show(current - 1);
  });

  // ?audit=1 (the video builder): lay out every slide, then publish overflow problems and the
  // box of each .clip as JSON attributes on <body>, which the builder reads from the dumped DOM.
  if (params.has('audit')) {
    const problems = [];
    const clips = [];
    sections.forEach((section, i) => {
      show(i);
      const rect = section.getBoundingClientRect();
      if (section.scrollHeight > section.clientHeight + 1) {
        problems.push({ slide: i + 1, id: section.id, issue: 'content overflows the slide', height: section.scrollHeight });
      }
      section.querySelectorAll('h1, h2, h3, p, li, pre, table, .card').forEach((el) => {
        const box = el.getBoundingClientRect();
        if (box.bottom > rect.bottom - 10 || box.right > rect.right + 1) {
          problems.push({ slide: i + 1, id: section.id, issue: 'element outside the slide', el: el.tagName.toLowerCase(), bottom: Math.round(box.bottom) });
        }
      });
      const clip = section.querySelector('.clip');
      if (clip) {
        const box = clip.getBoundingClientRect();
        clips.push({ slide: i + 1, x: Math.round(box.left - rect.left), y: Math.round(box.top - rect.top), w: Math.round(box.width), h: Math.round(box.height) });
      }
    });
    show(0);
    document.body.setAttribute('data-audit', JSON.stringify(problems));
    document.body.setAttribute('data-clips', JSON.stringify(clips));
  }
  window.slideCount = sections.length;
})();
