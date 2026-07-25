/* THE PEEL — pointer-driven corner lift.
 *
 * The peel tracks the pointer's distance from the bottom-right corner rather
 * than being a binary hover, because a sticker lifts progressively under a
 * finger. Click (or Enter/Space) latches it fully open so the code underneath
 * can actually be read — a reveal you must keep hovering to see is a tease, not
 * a feature.
 */
(() => {
	const root = document.querySelector('[data-peel]');
	if (!root) return;

	const card = root.querySelector('.peel');
	const under = root.querySelector('[data-peel-under]');
	const picker = root.querySelector('.peel-picker');
	const label = root.querySelector('[data-peel-label]');
	const sources = JSON.parse(root.querySelector('[data-peel-data]').textContent);

	let latched = false;
	let framework = 'react';

	const set = (v) => card.style.setProperty('--peel', Math.max(0, Math.min(1, v)).toFixed(3));

	const render = () => {
		under.textContent = sources[framework].code;
		label.textContent = sources[framework].label;
	};

	card.addEventListener('pointermove', (e) => {
		if (latched) return;
		const r = card.getBoundingClientRect();
		// distance from the bottom-right corner, normalised against the diagonal
		const dx = (r.right - e.clientX) / r.width;
		const dy = (r.bottom - e.clientY) / r.height;
		const d = Math.hypot(dx, dy);
		set(1 - Math.min(1, d / 0.85));
	});

	card.addEventListener('pointerleave', () => { if (!latched) set(0); });

	const toggle = () => { latched = !latched; set(latched ? 1 : 0); card.setAttribute('aria-expanded', String(latched)); };
	card.addEventListener('click', toggle);
	card.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
	});

	picker?.addEventListener('click', (e) => {
		const btn = e.target.closest('button[data-fw]');
		if (!btn) return;
		framework = btn.dataset.fw;
		picker.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
		render();
		if (!latched) { set(1); setTimeout(() => { if (!latched) set(0); }, 900); }
	});

	render();
})();
