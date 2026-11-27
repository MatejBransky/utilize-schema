import type { Html } from '@effect/ui/html';

const svg = <M>(h: Html.H<M>) =>
	h.svg
		.attr('viewBox', '0 0 16 16')
		.attr('aria-hidden', 'true')
		.attr('fill', 'none')
		.attr('stroke', 'currentColor');

export const CloseIcon = <M>(h: Html.H<M>) =>
	svg(h).children(h.path.attr('d', 'M4 4l8 8M12 4l-8 8').attr('stroke-width', '1.5'));

export const PencilIcon = <M>(h: Html.H<M>) =>
	svg(h).children(
		h.path
			.attr('d', 'M3 13l1-3 7-7 2 2-7 7-3 1z')
			.attr('stroke-width', '1.5')
			.attr('stroke-linejoin', 'round')
	);

export const CheckIcon = <M>(h: Html.H<M>) =>
	svg(h).children(h.path.attr('d', 'M3 8l3 3 7-7').attr('stroke-width', '1.5'));

export const PlusIcon = <M>(h: Html.H<M>) =>
	svg(h).children(h.path.attr('d', 'M8 3v10M3 8h10').attr('stroke-width', '1.5'));

export const AutoIcon = <M>(h: Html.H<M>) =>
	svg(h).children(
		h.circle.attr('cx', '8').attr('cy', '8').attr('r', '5.25').attr('stroke-width', '1.5'),
		h.path
			.attr('d', 'M8 2.75a5.25 5.25 0 0 1 0 10.5z')
			.attr('fill', 'currentColor')
			.attr('stroke', 'none')
	);

export const SunIcon = <M>(h: Html.H<M>) =>
	svg(h).children(
		h.circle.attr('cx', '8').attr('cy', '8').attr('r', '3').attr('stroke-width', '1.5'),
		h.path
			.attr(
				'd',
				'M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M12.6 3.4l-1.06 1.06M4.46 11.54 3.4 12.6'
			)
			.attr('stroke-width', '1.5')
	);

export const MoonIcon = <M>(h: Html.H<M>) =>
	svg(h).children(
		h.path
			.attr('d', 'M13.5 9.5A5.5 5.5 0 0 1 6.5 2a5.5 5.5 0 1 0 7 7.5z')
			.attr('stroke-width', '1.5')
			.attr('stroke-linejoin', 'round')
	);

export const GitHubIcon = <M>(h: Html.H<M>) =>
	h.svg
		.attr('viewBox', '0 0 16 16')
		.attr('aria-hidden', 'true')
		.attr('fill', 'currentColor')
		.children(
			h.path.attr(
				'd',
				'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z'
			)
		);

export const ChevronDownIcon = <M>(h: Html.H<M>) =>
	svg(h).children(h.path.attr('d', 'M4 6l4 4 4-4').attr('stroke-width', '1.5'));
