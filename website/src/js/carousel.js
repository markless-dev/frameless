/* Carousel behaviour — lifted verbatim from the kit component. */
(() => {
	const carousel = document.querySelector('[data-carousel]');
	const track = carousel.querySelector('.carousel__track');
	const items = [...carousel.querySelectorAll('.carousel__item')];
	const pages = [...carousel.querySelectorAll('.carousel__page')];
	const panel = carousel.querySelector('.carousel__panel');
	const stage = carousel.querySelector('.carousel__stage');

	// THE FOCAL POINT. A fraction of the stage rather than a pixel value, so it
	// stays put through a resize.
	//
	// 0.34 was correct while the detail panel took the right-hand side of the
	// stage. The panel now sits BELOW the row at every width, so the stage is full
	// width — and a row that already fits should not travel at all. Leaving 0.34 in
	// place pushed the tail of the row out of the stage: Qwik rendered 36% visible
	// on load, and selecting Qwik drove React and Vue to zero with ~600px of empty
	// stage on the right.
	const focalFraction = () => 0.5;

	// If the whole row fits the stage, centre it and never translate. Sliding a row
	// that already fits is what produced the occlusion — the carousel was solving a
	// problem it no longer had.
	const rowFits = () => track.scrollWidth <= stage.clientWidth + 1;

	let index = 0;

	function layout() {
		// At narrow widths the stage is a scroll container with snap points, so the
		// translate is disabled in CSS and the selected item is scrolled into view
		// instead. Translating a scrollable track fought the scroll position and
		// pushed the focal sticker off-screen.
		if (window.matchMedia('(max-width: 40rem)').matches) {
			items[index]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
			return;
		}
		if (rowFits()) {
			// centred as a block, no translate — every item stays whole in the stage
			track.style.translate = '0px';
			track.style.marginInline = 'auto';
			return;
		}
		track.style.marginInline = '';
		const item = items[index];
		// offsetLeft is measured against the TRACK, so it is unaffected by the
		// translate already applied to it — which is what makes this idempotent.
		// getBoundingClientRect would feed the current translate back in and the
		// row would creep a little further every time it is called.
		const centre = item.offsetLeft + item.offsetWidth / 2;
		const focal = stage.clientWidth * focalFraction();
		track.style.translate = `${Math.round(focal - centre)}px 0`;
	}

	function select(next, { focus = false } = {}) {
		index = (next + items.length) % items.length;
		items.forEach((item, i) => {
			const on = i === index;
			item.setAttribute('aria-selected', String(on));
			item.tabIndex = on ? 0 : -1;
		});
		pages.forEach((page) => {
			page.hidden = page.dataset.framework !== items[index].dataset.framework;
		});
		panel.setAttribute('aria-labelledby', items[index].id);
		carousel.dataset.open = 'true';
		layout();
		if (focus) items[index].focus();
	}

	items.forEach((item, i) => {
		item.addEventListener('click', () => select(i, { focus: true }));
	});

	track.addEventListener('keydown', (event) => {
		const keys = {
			ArrowRight: () => select(index + 1, { focus: true }),
			ArrowLeft: () => select(index - 1, { focus: true }),
			Home: () => select(0, { focus: true }),
			End: () => select(items.length - 1, { focus: true }),
		};
		if (keys[event.key]) {
			event.preventDefault();
			keys[event.key]();
		}
	});

	carousel.querySelector('[data-carousel-prev]').addEventListener('click', () => select(index - 1));
	carousel.querySelector('[data-carousel-next]').addEventListener('click', () => select(index + 1));
	carousel.querySelector('[data-carousel-close]').addEventListener('click', () => {
		carousel.dataset.open = 'false';
		items[index].focus();
	});

	carousel.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && carousel.dataset.open === 'true') {
			carousel.dataset.open = 'false';
			items[index].focus();
		}
	});

	// Relayout on resize, and once fonts have settled — the track's geometry
	// depends on text metrics, so measuring before the webfont lands puts the
	// focal point in the wrong place until something else forces a reflow.
	addEventListener('resize', layout);
	if (document.fonts) document.fonts.ready.then(layout);
	select(0);
})();
