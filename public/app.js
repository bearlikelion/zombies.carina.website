const LIVE_SECONDS = 20 * 60;

const $ = (selector) => document.querySelector(selector);

function h(tag, attrs = {}, ...children) {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(attrs)) {
		if (value == null || value === false) continue;
		if (key === 'class') node.className = value;
		else if (key === 'style') node.style.cssText = value;
		else node.setAttribute(key, value === true ? '' : value);
	}
	node.append(...children.flat().filter((child) => child != null && child !== false));
	return node;
}

async function getJSON(path) {
	const response = await fetch(path, { cache: 'no-cache' });
	if (!response.ok) throw new Error(`${path}: ${response.status}`);
	return response.json();
}

const number = (value) => Number(value).toLocaleString();

const plural = (count, word) => `${number(count)} ${word}${count === 1 ? '' : 's'}`;

const pad = (value) => String(value).padStart(2, '0');

function clock(seconds) {
	const s = Math.max(0, Math.round(seconds));
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	return hours ? `${hours}:${pad(minutes)}:${pad(s % 60)}` : `${minutes}:${pad(s % 60)}`;
}

function ordinal(n) {
	const teen = n % 100 >= 11 && n % 100 <= 13;
	return `${n}${teen ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

const prettyMap = (map) => map.replace(/([a-z])([A-Z])/g, '$1 $2');

const prettyWeapon = (weapon) => weapon.replace(/^Frontlines_/, '').replace(/_/g, ' ');

const profileUrl = (id) => `player.html?id=${encodeURIComponent(id)}`;

function when(timestamp) {
	return new Date(timestamp * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dispatch(meta) {
	const node = $('#dispatch');
	const age = Date.now() / 1000 - meta.snapshot_at;
	const live = age < LIVE_SECONDS;
	node.classList.toggle('on', live);
	const minutes = Math.round(age / 60);
	node.textContent = !live ? `Scores last updated ${when(meta.snapshot_at)}` : minutes < 1 ? 'Scores updated just now' : `Scores updated ${plural(minutes, 'minute')} ago`;
}

// A Steam avatar in an oval miniature, or the player's initial when there is none.
function portrait(player) {
	const frame = h('span', { class: 'portrait', 'aria-hidden': 'true' });
	if (player.avatar) frame.append(h('img', { src: player.avatar, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
	else frame.textContent = (player.name.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();
	return frame;
}


function rankMark(n) {
	const text = ordinal(n);
	return h('span', { class: 'ordinal' }, String(n), h('sup', {}, text.slice(String(n).length)));
}


const score = (points) => h('span', { class: 'score' }, number(points), h('small', {}, 'pts'));


function leader(label, value, attrs = {}) {
	return h('div', { class: 'leader', ...attrs }, label, h('span', { class: 'dots', 'aria-hidden': 'true' }), h('span', { class: 'value' }, value));
}

function playerLink(player) {
	return h('a', { class: 'player-link', href: profileUrl(player.id) }, portrait(player), h('span', { class: 'who' }, player.name));
}

function honorValue(honor, value) {
	if (honor.unit === 'seconds') return clock(value);
	return `${number(value)} ${value === 1 ? honor.unit.replace(/s$/, '') : honor.unit}`;
}


// Ink and icon per honor; paths from game-icons.net, CC BY 3.0, credited in the page footers.
const HONOR_ICONS = {
	survivor: ['brass', 'M92.656 19.188v41.5h331.72v-41.5H92.655zM119.5 79.374V433.53h22.28V79.376H119.5zm46.594 0c3.212 43.324 13.312 82.022 27.78 110.906 17.685 35.304 40.845 54.75 64.064 54.75 23.218 0 46.346-19.446 64.03-54.75 14.47-28.883 24.57-67.58 27.782-110.905H166.094zm209.156 0V433.53h22.28V79.376h-22.28zm-117.313 185.22c-23.218 0-46.378 19.415-64.062 54.717-14.835 29.614-25.098 69.562-28.03 114.22H350c-2.933-44.658-13.197-84.606-28.03-114.22-17.686-35.302-40.814-54.718-64.033-54.718zM92.657 452.218v41.467h331.718V452.22H92.655z'],
	deadliest: ['slime', 'M255.997 16.004c-120 0-239.997 60-239.997 149.998C16 226.002 61 256 61 316c0 45-15 45-15 75 0 14.998 48.01 32.002 89.998 44.998v60h239.997v-60s90.567-27.957 90-45c-.933-27.947-15-30-15-74.998 0-30 45.642-91.42 44.998-149.998 0-90-119.998-149.998-239.996-149.998zm-90 179.997c33.137 0 60 26.864 60 60 0 33.136-26.863 60-60 60C132.863 316 106 289.136 106 256c0-33.136 26.862-60 59.998-60zm179.998 0c33.136 0 60 26.864 60 60 0 33.136-26.864 60-60 60-33.136 0-60-26.864-60-60 0-33.136 26.864-60 60-60zm-89.998 105c15 0 45 60 45 75 0 29.998 0 29.998-15 29.998h-60c-15 0-15 0-15-30 0-15 30-74.998 45-74.998z'],
	patient_zero: ['scarlet', 'M259.646 33.586c-44.698 10.116-96.576 26.075-141.98 42.926-42.563 15.796-79.721 32.796-97.816 44.22l28.634 40.006C85.45 141.836 163.58 106.833 258.87 78.725c.115-12.307.426-26.651.777-45.14zm-.755 63.922c-89.553 26.838-163.813 59.876-199.809 78.035l11.363 15.877c64.955-26.867 129.99-52.813 189.244-73.865-.436-6.558-.686-13.057-.798-20.047zm10.861 35.584c-63.467 22.407-134.187 50.745-204.494 79.949l-.063-.148c-22.345 11.147-36.325 23.22-47.084 35.552 3.174.194 6.684.262 10.803-.04 11.524-.847 26.29-3.532 42.982-7.69 33.387-8.316 74.56-22.461 115.413-38.873 40.852-16.412 81.444-35.104 113.841-52.438 20.416-10.922 37.096-21.52 48.778-30.168-27.24-.104-57.425 6.306-80.176 13.856zm18.371 43.3a1084.226 1084.226 0 0 1-16.488 8.057c6.635 4.076 11.482 10.968 14.367 18.592 3.944 10.42 4.892 22.894 2.566 35.8-2.325 12.907-7.527 24.049-14.789 32.046s-17.434 13.233-28.275 10.888c-10.842-2.344-18.433-11.423-22.377-21.843-3.944-10.42-4.894-22.894-2.568-35.801 1.264-7.02 3.387-13.512 6.222-19.266a1358.468 1358.468 0 0 1-32.761 13.678 1248.826 1248.826 0 0 1-43.65 16.613c11.354 20.924 27.32 38.077 51.366 50.307l9.17 4.664-5.842 8.469c-8.506 12.333-6.783 30.624 1.875 43.974 8.659 13.35 21.871 20.897 38.64 14.395 59.434-23.047 104.228-28.81 145.775-21.113 34.839 6.454 67.127 22.398 103.834 43.81-12.425-28.256-33.968-57.384-60.729-82.209-33.985-31.525-76.04-56.09-116.33-64.65l-5.635-1.198-1.271-5.617c-.802-3.538-8.001-29.713-23.1-49.595zm-29.527 22.372c-2.798.11-6.202 1.744-9.908 5.826-4.563 5.024-8.733 13.374-10.53 23.348-1.796 9.973-.835 19.436 1.643 25.982 2.477 6.546 5.817 9.469 8.896 10.135 3.08.666 7.182-.646 11.744-5.67 4.563-5.024 8.735-13.377 10.532-23.35 1.796-9.973.833-19.436-1.645-25.982-2.478-6.547-5.817-9.469-8.896-10.135a7.293 7.293 0 0 0-1.836-.154zm-125.414 42.4c-18.266 6.199-35.82 11.553-51.98 15.748-4.18 24.009 9.737 55.444 19.53 71.184 36.172 26.058 68.19 52.072 126.23 70.021l-4.89-22.824c-12.567-3.576-23.285-12.214-30.234-22.93-10.383-16.01-14.055-37.249-6.25-55.41-23.92-14.166-40.703-33.554-52.406-55.789zm-56.55 92.08c-9.031 13.247-23.97 18.894-37.823 21.772 15.285 25.397 49.541 49.906 93.216 72.103 41.305 20.993 90.376 40.17 138.215 58.6-11.892-19.381-20.046-40.812-22.304-63.33-86.163-20.547-125.096-57.285-171.303-89.145zm-27.696 61.57C36.052 424.224 26.8 455.703 25.279 487h198.588c-34.824-13.775-69.286-28.225-99.998-43.834-29.2-14.84-55.252-30.589-74.933-48.352z'],
	slayer: ['brass', 'M27.084 18.248C-17.903 146.478 143.15 277.92 314.496 381.074c-4.645 13.767-5.585 27.628-3.394 40.635 4.44 26.355 20.974 48.997 42.86 62.425 21.884 13.428 49.776 17.57 75.645 5.765 25.87-11.804 48.69-38.923 62.737-84.654l-17.865-5.488c-13 42.318-32.806 64.094-52.63 73.14-19.825 9.047-40.69 5.998-58.116-4.693-17.425-10.69-30.75-29.095-34.205-49.6-3.455-20.507 2.232-43.318 24.677-65.218 20.743-20.24 32.068-41.615 30.434-61.24l-18.622 1.552c.74 8.89-4.35 22.76-16.684 37.486C222.057 230.8 73.838 128.622 27.084 18.248zm458.05 0C451.34 98.03 364.527 173.53 270.93 247.166c19.492 15.878 39.56 31.622 59.195 45.012 110.756-84.836 187.878-180.243 155.01-273.93zM127.58 292.146c-1.634 19.626 9.69 41 30.434 61.24 22.445 21.9 28.132 44.712 24.677 65.218-3.455 20.506-16.78 38.91-34.206 49.6-17.425 10.692-38.29 13.74-58.115 4.694-19.825-9.046-39.632-30.822-52.63-73.14l-17.865 5.488c14.046 45.73 36.867 72.85 62.736 84.654 25.87 11.805 53.763 7.663 75.648-5.765 21.885-13.428 38.42-36.07 42.86-62.426 2.19-13.005 1.25-26.863-3.393-40.628 13.986-8.42 27.905-17.022 41.648-25.803l-56.967-39.387c-6.55 5.103-13.063 10.2-19.52 15.293C150.55 316.46 145.46 302.59 146.2 293.7l-18.622-1.554zm18.1 73.614c-26.1 8.6-62.087 36.255-77.104 60.324 4.948 8.63 10.393 15.223 16.05 20.14 25.846-8.953 59.85-37.406 74.733-60.257-3.007-6.6-7.454-13.386-13.68-20.207zm220.863 0c-6.225 6.822-10.67 13.61-13.68 20.21 14.886 22.85 48.89 51.3 74.736 60.255 5.656-4.918 11.1-11.51 16.05-20.14-15.018-24.07-51.004-51.724-77.105-60.325z'],
	hold_the_line: ['brass', 'M93.313 19.406c-11.24 0-20.157 8.916-20.157 20.157 0 6.968 3.436 13.022 8.72 16.624L35.218 494.25H54l46.438-435.875c7.637-2.84 13-10.1 13-18.813 0-11.237-8.886-20.156-20.126-20.156zm23.906 52.688l-21.157 198.78 92.624 19.532 64.157-194L117.22 72.094zm137.593 78.28L190.625 344.44l58.28 11.03-3.81-57.874 27.03 29.906 18.594-7.844 11.31 45.875 82.69 15.626-34.033-68.437 29.844-12.658 23.033 32.563 42.5.188 1.875 17.875 39-24.375-35.813-8.532-7.938-29.655-45.78-2.406 3.28-30.845-35.437-19.406 15.03-31.095 28.064-21.344v-.093l-153.53-32.562zm189.875 9.44l2.125 34.53-51.22 23.312 71.782 4.375 16.22-15.718L462.904 172l-18.217-12.188zm-4.47 84.874l35.126 45.625 18.47-25.625-53.595-20zm-98.468 8.25l24.813 1.406 5.218 23.75-50.155 9.062 20.125-34.22zm-4.03 76.687l11.967 19.22-37.062 2.217 5.094-15.906 20-5.53zm79.874 16.5l-17.53 29.188 39.717 32.718 40.876-11.092-40.28-19.875-22.782-30.938z'],
	last_standing: ['brass', 'M258.75 23.563c-27.913 0-93.875 87.237-93.875 158.593 0 59.35 29.018 79.715 68.625 94.875-15.47-15.607-26.03-43.75-26.03-76.186 0-49.232 31.292-89.188 53.25-89.188 21.132 0 53.25 39.955 53.25 89.188 0 30.39-9.41 56.833-23.283 72.937 36.097-18.016 61.938-35.72 61.938-91.624 0-71.356-66.786-158.594-93.875-158.594zm6.72 175.906l-18.5 2.686c5.764 39.366 6.665 69.034 4.25 97.875-24.957-.97-49.677-5.972-73.69-14.75v95.47c-3.295 25.668-22.434 30.526-22.093 53.47.29 19.547 14.998 26.003 22.094 17.624v36.28h164.69v-88.343c8.615 10.89 27.17 3.06 27.53-21.31.432-29.117-24.597-34.605-27.53-68.814V285.28c-23.916 8.88-48.17 13.702-72.314 14.72 2.337-29.752 1.383-60.792-4.437-100.53z'],
	last_stand_hero: ['brass', 'M424.045 26.605l2.54 11.19 16.15-13.06zm-205.53 312.32a24.07 24.07 0 0 0 1.54-36l6.15-5.17c.72.73 1.41 1.5 2.07 2.31a32.09 32.09 0 0 1-45.62 44.74q2.13-3.69 4.14-7a24.12 24.12 0 0 0 31.72 1.12zm-18.1-19.47l10.32 7.66-15.53-2.3c.58-.81 1.14-1.58 1.69-2.29zm76.89-80.34l-31.33-38.65 15.26-12.34 31.33 38.65zm137.88-111.75l-31.33-38.65 15.27-12.37 31.33 38.64zm-41.83-26.18l25.91 32c-26.82 22.18-62.15 51.42-96.92 80.29l-26.75-33zm-252.76 239.74l10 1.16 32.83-65.86a28.13 28.13 0 0 0 41-38.11l4.52-3.67 26.53-21.52 27.14 33.48c-32.82 27.33-61.6 51.43-77.37 65-26.12 32.63-84.5 163.79-95.81 175.86-13.73-4.68-26.77-40.12-54-55.2 9.14-18.66 85.16-91.14 85.16-91.14zm33.05-113.81c1.5 2.11 5.69 5.81 8.38 5.81h.06c.35 0 1.29.17 2.48-1.65 7.15-11 18-16.41 25.26-12.77l-3.59 7.2c-1.77-.89-5.5.3-9.38 3.63l14.75 18.2a12.13 12.13 0 1 1-18.91.1l-6-7.44a10 10 0 0 1-4.4 1.12h-.23c-8.12 0-14.83-9.36-14.89-9.45zm259.84-158.46l46.5-37.73 11.06 13.68-46.49 37.69zm63.08 1.27l-37.46 30.31-5.73-7.07 37.42-30.34z'],
	first_bite: ['slime', 'M169.57 106.12c-1.882-14.48-28.184-30.424-41.092-30.424-2.54 0-4.56.612-5.773 1.974-21.81 24.385 14.225 81.262 14.225 81.262s35.746-28.785 32.64-52.812zm128.832 60.524s34.315-54.186 13.544-77.36c-1.155-1.292-3.083-1.88-5.496-1.88-12.308 0-37.352 15.183-39.142 28.98-2.967 22.78 31.094 50.26 31.094 50.26zm-53.724-50.352c-1.79-13.798-26.845-28.98-39.14-28.98-2.414 0-4.343.588-5.497 1.88-20.782 23.22 13.544 77.36 13.544 77.36s34.06-27.387 31.094-50.26zM58.128 58.896a16.544 16.544 0 0 0-1.664.08c-87.75 8.937 11.373 286.056 40.55 304.484 0 0-16.984-151.636 2.795-244.236 7.238-34.107-24.006-60.328-41.683-60.328zm397.394.08a16.465 16.465 0 0 0-1.663-.08c-17.678 0-48.968 26.198-41.682 60.328 19.778 92.6 2.794 244.236 2.794 244.236 29.223-18.416 128.312-295.535 40.55-304.483zm-72.013 16.72c-12.92 0-39.258 15.945-41.094 30.424-3.106 23.97 32.652 52.823 32.652 52.823s36.024-56.888 14.225-81.26c-1.224-1.375-3.244-1.987-5.784-1.987zm-148.3 348.98c-2.032-11.37-25.598-35.353-25.598-35.353s-20.54 23.97-20.32 33.727c0 2.147-1.155 23.092 2.03 26 2.876 2.645 12.84 4.043 22.62 4.043 9.468 0 18.75-1.305 21.268-4.042 2.31-2.47.335-22.733 0-24.373zm-60.04-24.35c-12.065-20.69-19.155-51.01-23.092-73.733-3.094-17.966-4.19-31.174-4.19-31.174-15.127 11.81-44.292 137.675 2.54 137.675a30.07 30.07 0 0 0 4.952-.428c4.62-.762 10.46-4.295 15.01-9.236 5.935-6.43 9.456-15.17 4.78-23.103zm188.85-104.93s-1.006 12.03-3.777 28.738c-3.81 22.965-10.98 54.74-23.485 76.204-3.764 6.466-2.136 13.417 1.744 19.236 4.618 6.86 12.308 12.135 18.035 13.082 1.636.279 3.293.421 4.953.427 46.912-.046 17.677-125.91 2.563-137.734zm-41.406 127.7c.22-9.757-20.32-33.726-20.32-33.726s-23.532 23.935-25.518 35.307c-.254 1.444-2.563 21.592 0 24.386 2.564 2.794 11.812 4.04 21.268 4.04 9.78 0 19.744-1.396 22.62-4.04 4.387-4.088 1.962-25.286 1.985-26.002z'],
	fresh_meat: ['scarlet', 'M312.094 21.97l59.094 119.686h52.093L362.595 22l-50.5-.03zM173 22.687l-63.594 127.218 65.844 345.75 114.688.094L354.467 150 291.626 22.75 173 22.687zm16.063 76.28h88.78v18.688h-88.78V98.97zm0 36.22h88.78v18.687h-88.78v-18.688zm182.5 25.156L309 495.438l47.25.03 68.313-335.124h-53z'],
	relentless: ['slime', 'M30.653 470.114l55.34-20.32 84.09-19.62 10.78 18.22 25 15.92 41.34-5.41 27.86 8.41 39.41 1.4 36.71-34.72 46.68 19.3 37.84 9.11 58.628 32.737H17.67zm238.6-202.77l-6 10c10.09 6.1 21.58 6.39 32.88 3.21a92.26 92.26 0 0 0 15.72-6.22c-.31 6.28-.36 16.58-.19 29.29l-18.82-2.87 3.86 115 19.72-.85c.69 9.53 1.45 18.47 2.27 26.44l-10.72 10.14-30.09-1.07-25.79-7.77-3.5-1.06-3.62.47-35.2 4.59-4.89-3.12c8.11-37.88 17.45-123.11 19.51-141.7.89-7.27 1.226-14.6 1-21.92l9.89-5.34.7-6.39-3-6.52h-8.88l-4.65-9.13-1.83.63a30 30 0 0 0-2.63-3.11l-.08-.08-24-25.88 2.36-6-1.18-7.08-8.51-2.36-2.07-10-13.35.87-30.95-33.39c.53-4.33 3-9.83 6.9-14.16 3.7-4.16 8.26-6.81 11.88-7.54l59 62.41 9.49-6.55-43.09-89.08c1.73-4 5.71-8.14 10.73-10.83 4.84-2.6 10.11-3.49 13.75-3l45.5 92.27 11-3.53-16.29-98.92c2.68-2.68 7.66-5.23 13-6a27.14 27.14 0 0 1 3.55-.27h1.17a21.3 21.3 0 0 1 9.93 2.59l15.06 94.32 11.43.35 17.77-80.41c5.89 4.64 19.24 15.77 19.24 15.77l7.25-2.3-19.62 89.33h.06l-1.44 6.31-.64 2.88 8.88 5.78c14.3-8.86 28.38-18 40.27-22.17 7.78-2.7 14.2-3.2 19.36-1.17 4.25 1.67 8.26 5.37 11.9 12.43-29.73 14.51-55.85 34.55-78.25 48.74-11.87 7.52-22.69 13.34-32 16-9.31 2.66-16.73 2.22-23.75-2.03zm-9.84 65.39v26l11.38 9.15-4.78 6.2.28 18.89 8.3 9.15 11.94 9.9-3.6-107.26-8.34 5.56-7.74 22.43h-7.44z'],
};


function honorItem(honor) {
	const [first, ...rest] = honor.top;
	const [ink = 'brass', path] = HONOR_ICONS[honor.key] || [];
	const icon = h('span', { class: 'honor-icon', 'aria-hidden': 'true' });
	icon.innerHTML = `<svg viewBox="0 0 512 512"><path d="${path}"/></svg>`;
	return h('li', { class: 'honor', style: `--ink: var(--${ink})` },
		h('div', { class: 'honor-head' }, path && icon, h('div', {}, h('h3', {}, honor.title), h('p', {}, honor.description))),
		first ? leader(playerLink(first), honorValue(honor, first.value)) : h('p', { class: 'unclaimed' }, 'Unclaimed. Be the first.'),
		rest.length > 0 && h('ol', { class: 'runners', 'aria-label': 'Runners up' }, rest.map((runner, i) => h('li', {},
			leader([h('span', { class: 'scarlet' }, ordinal(i + 2)), ' ', h('a', { href: profileUrl(runner.id) }, runner.name)], honorValue(honor, runner.value))))),
	);
}


function meters(rows, label, count, side) {
	const max = Math.max(1, ...rows.map(count));
	return h('ul', { class: 'meters' }, rows.map((row) => h('li', {},
		h('span', { class: 'label' }, label(row)),
		h('span', { class: `bar ${side ? side(row) : ''}`, style: `width: ${(count(row) / max) * 100}%` }),
		h('span', { class: 'count' }, number(count(row))),
	)));
}

// Arcade bonus tally: the number runs up from zero, or lands at once with reduced motion.
function tally(node, target, format = number) {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
		node.textContent = format(target);
		return;
	}
	const start = performance.now();
	const step = (now) => {
		const progress = Math.min(1, (now - start) / 1400);
		node.textContent = format(Math.round(target * (1 - Math.pow(2, -10 * progress))));
		if (progress < 1) requestAnimationFrame(step);
		else node.textContent = format(target);
	};
	requestAnimationFrame(step);
}

const PAGE_SIZE = 25;


function ruleIcons() {
	for (const node of document.querySelectorAll('[data-icon]')) {
		const [, path] = HONOR_ICONS[node.dataset.icon] || [];
		if (path) node.innerHTML = `<svg viewBox="0 0 512 512"><path d="${path}"/></svg>`;
	}
}


async function rollPage() {
	ruleIcons();
	let rows = [];
	let sort = { key: 'points', dir: -1 };
	let page = 0;

	function renderTable() {
		const query = $('#search').value.trim().toLowerCase();
		const shown = rows
			.filter((row) => row.name.toLowerCase().includes(query))
			.sort((a, b) => {
				const x = a[sort.key];
				const y = b[sort.key];
				return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir || a.rank - b.rank;
			});
		const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
		page = Math.min(page, pages - 1);
		const first = page * PAGE_SIZE;
		$('#roll tbody').replaceChildren(...shown.slice(first, first + PAGE_SIZE).map((row) => h('tr', {},
			h('td', { class: 'rank' }, rankMark(row.rank)),
			h('td', { class: 'player-cell' }, playerLink(row)),
			h('td', { class: 'stat' }, number(row.human_kills)),
			h('td', { class: 'stat' }, number(row.human_deaths)),
			h('td', { class: 'stat' }, clock(row.time_alive)),
			h('td', { class: 'stat zk' }, number(row.zombie_kills)),
			h('td', { class: 'stat zd' }, number(row.zombie_deaths)),
			h('td', { class: 'pts' }, number(row.points)),
			h('td', { class: 'line' },
				'K/D ', h('span', { class: 'brass' }, `${row.human_kills}/${row.human_deaths}`), ' human, ',
				h('span', { class: 'slime' }, `${row.zombie_kills}/${row.zombie_deaths}`), ' zombie'),
		)));
		const turn = (to) => h('button', { type: 'button', disabled: to < 0 || to >= pages, 'aria-label': to < page ? 'Previous page' : 'Next page' }, to < page ? 'Previous' : 'Next');
		const previous = turn(page - 1);
		const next = turn(page + 1);
		previous.addEventListener('click', () => go(page - 1));
		next.addEventListener('click', () => go(page + 1));
		$('#pager').hidden = pages < 2;
		$('#pager').replaceChildren(previous, h('span', { 'aria-live': 'polite' }, `${number(first + 1)} to ${number(Math.min(first + PAGE_SIZE, shown.length))} of ${plural(shown.length, 'player')}, page ${page + 1} of ${pages}`), next);
		const empty = $('#empty');
		empty.hidden = shown.length > 0;
		empty.textContent = rows.length ? `No player named "${query}" yet. Check the spelling, or play a round to join the board.` : 'No rounds played yet. Players appear here a few minutes after the first round starts.';
		for (const th of document.querySelectorAll('#roll th[data-key]')) {
			if (th.dataset.key === sort.key) th.setAttribute('aria-sort', sort.dir < 0 ? 'descending' : 'ascending');
			else th.removeAttribute('aria-sort');
		}
	}

	function renderBoard() {
		const query = $('#search').value.trim().toLowerCase();
		const matches = query ? rows.filter((row) => row.name.toLowerCase().includes(query)) : rows;
		$('#scores').replaceChildren(...matches.slice(0, 10).map((row) => h('li', {},
			h('a', { class: 'score-row', href: profileUrl(row.id) },
				rankMark(row.rank),
				portrait(row),
				h('span', { class: 'who' }, row.name),
				score(row.points)))));
		if (!matches.length) {
			$('#scores').append(h('li', { class: 'empty' }, rows.length ? `No player named "${query}" yet.` : 'No scores yet. They appear a few minutes after the first round starts.'));
		}
	}


	async function load() {
		const [meta, data] = await Promise.all([getJSON('data/meta.json'), getJSON('data/all-time.json')]);
		dispatch(meta);
		const s = data.summary;
		$('#ledger').replaceChildren(
			h('li', {}, h('strong', {}, number(s.human_lives_lost)), ` ${s.human_lives_lost === 1 ? 'human' : 'humans'} fallen`),
			h('li', {}, h('strong', {}, number(s.zombies_defeated)), ` ${s.zombies_defeated === 1 ? 'zombie' : 'zombies'} put down`),
			h('li', {}, h('strong', {}, number(s.rounds)), ` ${s.rounds === 1 ? 'round' : 'rounds'}`),
		);
		$('#honors').replaceChildren(...(data.honors.some((honor) => honor.top.length)
			? data.honors.map(honorItem)
			: [h('li', { class: 'empty' }, 'No honors awarded yet. Each goes to the player who leads its category once rounds are played.')]));
		const p = meta.points;
		$('#points').replaceChildren(
			h('li', {}, h('strong', {}, `+${p.zombie_kill}`), 'each human you kill as a zombie'),
			h('li', {}, h('strong', {}, `+${p.human_kill}`), 'each zombie you kill as a human'),
			h('li', {}, h('strong', {}, `+${p.human_minute}`), 'every minute you stay human'),
			h('li', {}, h('strong', {}, `+${p.round_survived}`), 'every round you survive to the timer'),
		);
		rows = data.leaderboard;
		for (const id of ['#hall', '#rules', '#roll']) $(id).hidden = false;
		renderBoard();
		renderTable();
	}

	function go(to) {
		page = to;
		renderTable();
		$('#roll').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
	}

	for (const th of document.querySelectorAll('#roll th[data-key]')) {
		const button = h('button', { type: 'button' }, th.textContent);
		th.replaceChildren(button);
		button.addEventListener('click', () => {
			const key = th.dataset.key;
			sort = { key, dir: sort.key === key ? -sort.dir : (key === 'name' || key === 'rank' ? 1 : -1) };
			page = 0;
			renderTable();
		});
	}
	$('#search').addEventListener('input', () => {
		page = 0;
		renderBoard();
		renderTable();
	});
	try {
		await load();
	} catch {
		for (const id of ['#hall', '#rules', '#roll']) $(id).hidden = true;
		renderBoard();
		renderTable();
	}
	setInterval(() => load().catch(() => {}), 60 * 1000);
}


function heldHonor(honor) {
	const tip = h('span', { class: 'tip', id: `held-${honor.key}`, role: 'tooltip', hidden: true },
		honor.description, ' ', h('span', { class: 'brass' }, `Held with ${honorValue(honor, honor.top[0].value)}`));
	const button = h('button', { type: 'button', 'aria-describedby': tip.id }, honor.title);
	const item = h('li', {}, button, tip);
	const show = (on) => {
		tip.hidden = !on;
		tip.style.left = '';
		if (!on) return;
		const over = tip.getBoundingClientRect().right + 16 - document.documentElement.clientWidth;
		if (over > 0) tip.style.left = `${-over}px`;
	};
	item.addEventListener('pointerenter', (event) => event.pointerType === 'mouse' && show(true));
	item.addEventListener('pointerleave', (event) => event.pointerType === 'mouse' && show(false));
	button.addEventListener('focus', () => button.matches(':focus-visible') && show(true));
	button.addEventListener('blur', () => show(false));
	button.addEventListener('click', (event) => show(event.pointerType === 'mouse' || tip.hidden));
	document.addEventListener('keydown', (event) => event.key === 'Escape' && show(false));
	return item;
}


async function playerPage() {
	const id = new URLSearchParams(location.search).get('id');
	let player;
	let meta;
	let all;
	try {
		[player, meta, all] = await Promise.all([getJSON(`data/players/${encodeURIComponent(id)}.json`), getJSON('data/meta.json'), getJSON('data/all-time.json')]);
	} catch {
		$('#profile').replaceChildren(h('section', { class: 'results' },
			h('h1', {}, 'Player not found'),
			h('p', { class: 'note' }, 'Nobody with that id is on the board. Pick a name from the top 10.')));
		return;
	}
	dispatch(meta);
	document.title = `${player.name} · Zombies`;
	const held = all.honors.filter((honor) => player.honors.includes(honor.key));
	const records = player.records;
	const nemesis = player.nemesis;
	$('#profile').replaceChildren(
		h('section', { class: 'dossier' },
			h('div', { class: 'sky', 'aria-hidden': 'true' },
				h('img', { class: 'wash', src: player.avatar || 'moon.webp', alt: '', referrerpolicy: 'no-referrer' }),
				h('img', { class: 'sky-moon', src: 'moon.webp', alt: '', width: 1100, height: 1100 })),
			portrait(player),
			h('div', {},
				h('h1', {}, player.name),
				h('p', { class: 'standing' }, h('span', { class: 'ordinal-text' }, `${ordinal(player.rank)} of ${all.leaderboard.length}`), ' with ', h('span', { class: 'score' }, number(player.points)), ` points across ${plural(player.rounds, 'round')}`),
				h('p', { class: 'note' }, `First seen ${when(player.first_seen)}, last seen ${when(player.last_seen)}`),
				held.length > 0 && h('ul', { class: 'held' }, held.map(heldHonor)))),
		h('div', { class: 'ledgers' }, h('section', {},
			h('h2', {}, 'Rivals and records'),
			h('div', { class: 'rival-lists' },
				h('ul', { class: 'stat-list' },
					h('li', {}, leader(h('span', { class: 'label' }, 'Nemesis'), nemesis ? [h('a', { href: profileUrl(nemesis.id) }, nemesis.name), `, killed them ${plural(nemesis.count, 'time')}`] : 'Nobody yet')),
					h('li', {}, leader(h('span', { class: 'label' }, 'Favorite prey'), player.prey ? [h('a', { href: profileUrl(player.prey.id) }, player.prey.name), `, ${plural(player.prey.count, 'kill')}`] : 'Nobody yet'))),
				h('ul', { class: 'stat-list' },
					h('li', {}, leader(h('span', { class: 'label' }, 'Longest life'), records.longest_life ? `${clock(records.longest_life.value)} on ${prettyMap(records.longest_life.map)}` : 'None yet')),
					h('li', {}, leader(h('span', { class: 'label' }, 'Most kills in a round'), records.most_kills ? `${number(records.most_kills.value)} on ${prettyMap(records.most_kills.map)}` : 'None yet')),
					h('li', {}, leader(h('span', { class: 'label' }, 'Best round'), records.best_round ? `${number(records.best_round.value)} pts on ${prettyMap(records.best_round.map)}` : 'None yet'))))),
		h('section', { class: 'split-sides' },
			h('div', { class: 'human-side' },
				h('h2', {}, 'As a human'),
				h('ul', { class: 'stat-list' },
					h('li', {}, leader(h('span', { class: 'label' }, 'Zombies killed'), number(player.human_kills))),
					h('li', {}, leader(h('span', { class: 'label' }, 'Times infected'), number(player.human_deaths))),
					h('li', {}, leader(h('span', { class: 'label' }, 'Time alive'), clock(player.time_alive))),
					h('li', {}, leader(h('span', { class: 'label' }, 'Rounds survived'), number(player.rounds_survived))),
					h('li', {}, leader(h('span', { class: 'label' }, 'Outbreak picks'), number(player.outbreak_picks))))),
			h('div', { class: 'zombie-side' },
				h('h2', {}, 'As a zombie'),
				h('ul', { class: 'stat-list' },
					h('li', {}, leader(h('span', { class: 'label' }, 'Humans killed'), number(player.zombie_kills))),
					h('li', {}, leader(h('span', { class: 'label' }, 'Times put down'), number(player.zombie_deaths))),
					h('li', {}, leader(h('span', { class: 'label' }, 'Rounds played'), number(player.rounds))))))),
		h('section', { class: 'maps' }, h('h2', {}, 'Maps fought'), meters(player.maps, (row) => prettyMap(row.map), (row) => row.rounds)),
		h('footer', { class: 'foot' },
			h('a', { href: './' }, 'Back to the top 10'),
			h('span', {}, 'Scores refresh every few minutes while the server is busy')),
	);
}


function svg(tag, attrs = {}, ...children) {
	const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const [key, value] of Object.entries(attrs)) if (value != null) node.setAttribute(key, value);
	node.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
	return node;
}


// Report icons from game-icons.net, CC BY 3.0, credited in the footer.
const REPORT_ICONS = {
	fallen: 'M253.75 18.906c-77.635.03-154.875 54.01-154.875 167.5v209.72c25.67 19.717 46.68 41.386 52.156 69.124-3.507-44.464-4.166-88.692 14.595-133.156 5.265 38.52 8.087 77.137 26.875 115.656 25.316-53.302 59.948-75.555 102.188-72.438-29.706 25.94-56.26 55.26-74.75 95.22 31.477-30.2 66.886-38.728 103.968-40.907-21.57 15.247-41.576 30.414-54.156 50.22h78.344c6.443-27.99-4.756-54.648-17.78-82.908 27.59 18.168 51.09 40.4 61.905 77.657 3.525-39-3.843-73.686-15.19-106.875 13.34 6.44 23.875 15.568 31.595 27.374V186.406c0-113.616-77.24-167.528-154.875-167.5zM150.156 144.594h114.938v18.687H150.156v-18.686zm152.438 0h56.125v18.687h-56.126v-18.686zm-152.438 42.75h36.5v18.687h-36.5v-18.686zm72.25 0H358.72v18.687H222.405v-18.686zm-72.28 40.312h95.81v18.688h-95.81v-18.688zm126.31 0h82.283v18.688h-82.283v-18.688zm-177.56 189.53v62.658h23.686c-4.638-21.58-13.086-42.375-23.687-62.656z',
	put_down: 'M206.875 27.03l-3 2.064c-14.3 9.87-22.835 28.048-25.344 52.375-19.293 11.407-37.976 13.766-50.843 10.905-4.06 4.988-6.62 10.712-8.937 16.938 20.462 6.71 47.52 2.697 73.688-14.344l3.906-2.532.312-4.657c1.392-21.138 7.59-34.313 15.25-41.186l22.344 3.093c-1.668 18.234-1.372 38.198 7.53 60.376l2.657 6.562 7.032-.78c23.817-2.638 31.686-3.652 54.81.405l7.533 1.313 2.78-7.126c3.936-10.084 7.778-18.638 12.376-25.968 6.878 6.72 15.8 12.09 25.31 16.093 11.845 4.985 24.8 8.13 36.595 5.093-3.235-5.86-7.044-12.416-10.97-18-5.35-.25-11.948-1.607-18.374-4.312-11.263-4.742-21.638-13.227-24.686-18.75L330.47 53.03l-8.783 9.876c-8.824 9.927-14.54 21.44-19.687 33.907-16.88-2.398-28.733-2-45.188-.282-6.25-19.213-5.357-36.077-3.156-53.75l1.125-9.124-9.124-1.28-35.187-4.845-3.595-.5zm171.094 6.845L367.686 49.78c17.986 12.885 30.035 27.273 40.375 47.814l3.282 6.53-4.28 5.94c-6.31 8.73-11.433 19.695-15.908 32.374 4.09 11.243 6.268 24.716 6.28 35.968l.033 14.188-14.033-2.28L354 185.5l-26.594 29.188-11.97 13.125-7.78-15.938-16.594-34.03c-10.396 12.86-19.287 23.182-30.593 30.936-15.34 10.52-34.276 14.385-61 12.564l-8.126-.563-2.5-7.75L177.78 179l-40.624 7.844-11.937 2.344-2.19-12s-2.258-12.142-6.31-25.532c-2.028-6.695-4.507-13.658-7.157-19.156-2.65-5.498-5.83-9.36-6.75-10.03l-6.47-4.72 1.876-7.813c4.586-19.172 17.198-36 37.218-50.374l-10.72-19.813C56.08 95.554 25.5 197.82 24.095 296.344c43.835 22.98 73.8 47.83 92.28 74.844 17.738 25.923 24.46 53.747 23.407 81.562 11.497 6.293 22.977 11.934 35.69 15.344 21.81 5.85 45.39 8.69 69.78 8.687 24.396-.003 49.41-2.844 72.375-8.717 18.33-4.69 35.105-11.838 50.656-20.47 1.95-55.263 35.304-110.082 118.814-151.468-1.55-97.394-34.025-206.568-109.125-262.25zM202.436 250.063c6.002 3.154 11.246 7.896 14.625 13.75 12.22 21.162-.962 51.59-29.218 67.906-28.256 16.313-61.282 12.128-73.5-9.033-6.974-12.077-5.45-27.048 2.156-40.812 12.835-.22 27.956-2.805 44.25-9.03 15.522-5.93 30.078-14.063 41.688-22.783zm106.22 0c11.61 8.72 26.164 16.852 41.687 22.78 16.294 6.227 31.415 8.812 44.25 9.032 7.607 13.764 9.13 28.735 2.156 40.813-12.218 21.16-45.213 25.346-73.47 9.03-28.255-16.314-41.436-46.743-29.217-67.906 3.38-5.853 8.592-10.595 14.593-13.75zm-53.063 75.625c18.53 36.128 33.233 72.246 40.53 108.375-27.02-8.244-54.042-9.343-81.062 0 9.866-36.13 21.727-72.247 40.532-108.375z',
	rounds: 'M476.865 25.514L282.941 145.422l19.32 9.215L486.333 40.822l-9.467-15.308zM73.6 65.508l-7.748 16.246 286.595 136.709 1.389 2.715c3.244 6.346 9.677 12.524 17.723 16.373l.003.002.004.002c8.566 4.084 17.188 5.364 23.63 4.373 6.443-.992 10.352-3.63 12.523-8.18 2.17-4.55 1.665-8.39-1.725-13.603-3.39-5.213-10.122-10.882-18.935-15.086-8.063-3.843-16.927-4.961-23.91-3.487l-2.983.63L73.6 65.507zm121.097 97.65c-40.936 2.913-77.435 8.644-106.084 16.283-21.165 5.644-38.06 12.392-48.953 19.26C28.767 205.57 25 211.723 25 216c0 4.277 3.767 10.43 14.66 17.299 10.894 6.868 27.788 13.616 48.953 19.26C130.943 263.847 190.374 271 256 271c49.18 0 94.88-4.017 132.512-10.781-8.123-.325-16.546-2.53-24.703-6.422l-.002-.002-.004-.002c-10.2-4.878-18.614-12.38-24.135-21.484l-72.705-34.68-36.498 22.566c-4.5 9.65-12.051 18.021-21.662 23.977l-.002.002-.004.002c-10.715 6.625-22.297 10.072-33.281 9.588-10.985-.484-21.794-5.485-27.856-15.29-6.062-9.803-5.366-21.696-.515-31.294 4.85-9.598 13.3-17.76 23.785-24.243l.002-.001h.002c9.63-5.951 20.504-8.973 31.16-8.688l6.904-4.27-14.3-6.82zm127.432.36l-.545.336 41.3 19.7c10.563-1.44 21.702.385 31.92 5.257h.005c11.125 5.306 20.412 12.504 26.275 21.52 5.863 9.014 7.844 20.763 2.88 31.167-3.08 6.457-8.178 11.27-14.2 14.395 4.699-1.07 9.273-2.174 13.623-3.334 21.165-5.644 38.06-12.392 48.953-19.26C483.233 226.43 487 220.277 487 216c0-4.277-3.767-10.43-14.66-17.299-10.894-6.868-27.788-13.616-48.953-19.26-27.516-7.337-62.286-12.91-101.258-15.923zm-93.81 15.677l-21.499 13.293-3.033-.3c-7.102-.708-15.793 1.364-23.39 6.058l-.002.002c-8.305 5.135-14.382 11.502-17.186 17.05-2.804 5.55-2.89 9.422-.238 13.71 2.651 4.288 6.822 6.486 13.336 6.773 6.513.287 14.949-1.923 23.023-6.916 7.58-4.699 13.305-11.538 15.842-18.199l1.086-2.85 31.383-19.404-19.323-9.217zM39.642 253.912l26.941 44.9 33.31-24.982a408.545 408.545 0 0 1-15.92-3.879c-17.352-4.627-32.253-9.928-44.331-16.039zm432.714 0c-12.078 6.11-26.98 11.412-44.332 16.04-6.926 1.846-14.283 3.565-21.949 5.175l38.926 24.377 27.355-45.592zM487 264.492l-17.576 29.293a90.955 90.955 0 0 0 2.209-.97c5.948-2.72 10.255-5.583 12.627-7.944 2.371-2.361 2.74-3.683 2.74-4.871v-15.508zm-462 .002V280c0 1.188.369 2.51 2.74 4.871 2.372 2.361 6.679 5.224 12.627 7.943.712.326 1.45.65 2.207.971L25 264.495zm98.639 14.027l-36.737 27.553c1.874.36 3.74.72 5.674 1.065 21.728 3.862 47.224 6.792 74.612 8.775l-36.143-36.143a573.54 573.54 0 0 1-7.406-1.25zm233.996 4.538c-23.345 2.877-48.603 4.787-75.155 5.552l37.08 27.809 38.075-33.361zm27.261.045l-37.195 32.59c26.286-1.979 50.764-4.83 71.723-8.555 1.011-.18 1.972-.373 2.967-.557l-37.495-23.478zm-224.369.697l32.317 32.316 36.676-27.506c-24.226-.698-47.389-2.342-68.993-4.81zM256 291.25l-36.322 27.242c12.024.332 24.171.508 36.322.508 12.15 0 24.298-.176 36.322-.508L256 291.25zM25 305.121V440c0 5.5 4.3 11.699 16.09 18.436 3.953 2.259 8.63 4.452 13.91 6.554V317.13c-8.28-2.377-15.693-5.007-22.117-7.943-2.813-1.287-5.44-2.63-7.883-4.065zm462 0c-2.443 1.435-5.07 2.778-7.883 4.065-6.424 2.936-13.838 5.566-22.117 7.943V464.99c5.28-2.103 9.957-4.295 13.91-6.554C482.7 451.699 487 445.5 487 440V305.121zM73 321.63v149.488c6.196 1.816 12.868 3.523 19.953 5.098 25.716 5.714 56.789 9.79 90.047 12.2V334.978c-34.264-1.945-66.46-5.297-93.576-10.118A430.035 430.035 0 0 1 73 321.63zm366 0a430.032 430.032 0 0 1-16.424 3.232c-27.115 4.82-59.312 8.173-93.576 10.118v153.435c33.258-2.409 64.331-6.485 90.047-12.2 7.085-1.574 13.757-3.281 19.953-5.097V321.63zM201 335.87v153.684c18.028.96 36.517 1.445 55 1.445 18.483 0 36.972-.485 55-1.445V335.87c-18.053.752-36.52 1.129-55 1.129-18.48 0-36.947-.377-55-1.129z',
	players: 'M164.594 21.625c-.537.012-1.068.028-1.563.094-29.656 3.852-52.56 35.847-52.56 74.75 0 21.55 7.307 41.193 18.686 54.905-61.678 11.594-66.563 115.158-66.562 188.063h43.218l11.094 152.437h63.063L168.905 340.03h21.47l11.343 152.158h108.686l10.03-152.157h21.627l-9.907 151.845h63.063l10.53-152.438h40.28c0-73.107 1.407-178.78-65.967-189.218 10.89-13.646 18.093-32.734 18.093-53.75 0-41.496-26.52-74.75-59-74.75-2.03 0-4.43-.263-6.406 0-9.4 1.22-17.562 5.455-25.125 11.686 16.388 13.303 27.468 36.433 27.47 63.063 0 21.016-7.236 40.104-18.126 53.75 67.373 10.438 66 116.11 66 189.218h-21.94c.008-73.086 1.29-178.215-65.905-188.625 10.89-13.647 17.906-32.61 17.906-53.625 0-41.497-26.457-75-58.936-75-2.03 0-4.117-.262-6.094 0-29.657 3.85-52.813 36.095-52.813 75 0 21.547 7.373 40.788 18.75 54.5-61.514 11.563-66.318 114.874-66.343 187.75H126.25c-.002-72.905 4.322-176.47 66-188.063-11.38-13.712-18.687-33.356-18.688-54.906 0-26.575 11.138-49.632 27.438-63.064-9.148-7.425-19.896-11.687-31.53-11.687-1.525 0-3.267-.132-4.876-.095z',
	hours: 'M254.84 255.64a127.867 127.867 0 1 0 61.614 76.03 127.04 127.04 0 0 0-61.615-76.03zm-31.233 212.62a103.9 103.9 0 0 1-79.58-8.33 104.52 104.52 0 1 1 79.58 8.33zm54.65-125.248a87.963 87.963 0 1 0-59.328 109.373 87.414 87.414 0 0 0 59.327-109.373zm-37.1 38.962a8.28 8.28 0 0 1-9.56 6.747l-37.256-6.436a8.362 8.362 0 0 1-.827-.186h-.124a8.28 8.28 0 0 1-.88-.32l-.24-.104a8.175 8.175 0 0 1-.9-.487h-.07l-59.174-37.244a8.28 8.28 0 0 1 8.817-14.012l57.755 36.324 35.67 6.158a8.28 8.28 0 0 1 6.76 9.562zm164.75-76.838c10.09 34.016 15.046 67.203 13.94 93.478-1.12 26.69-8.156 38.176-14.365 40.018-6.21 1.842-18.368-3.943-33.87-25.706-15.244-21.42-29.194-51.95-39.325-85.955-22.53-75.947-14.933-128.942.424-133.495 15.36-4.553 50.668 35.703 73.197 111.66zm-25.8-95.517a136.808 136.808 0 0 0-12.914-15.772q13.712 4.625 26.42 16.65c19.124 18.13 35.33 48.71 44.498 83.886 8.963 34.512 10.35 69.884 3.85 97.06a99.894 99.894 0 0 1-6.405 18.523c.362-3.322.632-6.86.797-10.67 1.17-28.044-4.015-63.126-14.612-98.88-10.597-35.754-25.354-67.98-41.632-90.798zM357.104 16.1h-16.868v.125a8.765 8.765 0 0 1-.518 6.737 8.765 8.765 0 0 1-5.174 4.398 8.838 8.838 0 0 1-11.125-5.65l-1.748-5.61h-17.417l3.508 10.743c.094.29.218.56.322.838a25.168 25.168 0 0 0-11.456 10.35l-11.383 19.662a25.302 25.302 0 0 0-3.322 10.576 25.457 25.457 0 0 0-7.864 1.263l-19.662 6.437a25.21 25.21 0 0 0-7.358-11.59l-16.92-15.16a25.2 25.2 0 0 0-18.327-6.458 25.758 25.758 0 0 0-2.992.34 25.426 25.426 0 0 0-24.464-18.627H161.64a25.416 25.416 0 0 0-25.096 21.64 25.56 25.56 0 0 0-5.38.175 25.22 25.22 0 0 0-16.755 9.84l-13.692 18.11a25.416 25.416 0 0 0 3.177 34.08 25.364 25.364 0 0 0-4.036 22.435l6.456 21.732a25.24 25.24 0 0 0 9.17 13.11 32.267 32.267 0 0 0 25.933 51.496h1.19l4.273 14.395a151.463 151.463 0 0 1 5.91-1.904q4.738-1.406 9.51-2.472l-4.316-14.56a32.267 32.267 0 0 0-3.912-57.394 25.27 25.27 0 0 0 .962-17.075l-6.457-21.733a25.24 25.24 0 0 0-7.244-11.55l13.63-18.036a25.23 25.23 0 0 0 4.842-11.517c.62 0 1.252.072 1.883.072h22.706a25.406 25.406 0 0 0 4.346-.382 25.21 25.21 0 0 0 7.513 12.138l16.807 15.12a25.28 25.28 0 0 0 16.94 6.48 25.57 25.57 0 0 0 6.002-.726c.062.228.124.445.197.673a25.426 25.426 0 0 0 24.103 17.51 25.478 25.478 0 0 0 7.906-1.273l21.576-7.047a25.416 25.416 0 0 0 17.447-22.022 25.52 25.52 0 0 0 6.56-.88 25.21 25.21 0 0 0 15.41-11.828l11.384-19.662a25.333 25.333 0 0 0 1.83-21.37A25.437 25.437 0 0 0 357.104 16.1zM122.19 147.808l-6.457-21.732a8.745 8.745 0 0 1 7.027-11.207c.414 0 .828-.063 1.242-.114h.186a8.838 8.838 0 0 1 8.465 6.312l6.458 21.732a8.817 8.817 0 0 1-4.987 10.618c-.63.145-1.263.31-1.894.497l-.415.134a8.838 8.838 0 0 1-9.603-6.24zm19.23 21.308a15.875 15.875 0 1 1-5.465 1.035 25.94 25.94 0 0 0 1.914-.487l.796-.26a15.668 15.668 0 0 1 2.773-.288zm.237-92.382l-13.64 18.12a8.776 8.776 0 0 1-5.474 3.353c-.497 0-1.035.083-1.5.145a8.817 8.817 0 0 1-7.11-14.124l13.69-18.11a8.827 8.827 0 1 1 14.034 10.617zm50.594-23.036q-.61.89-1.148 1.81a8.807 8.807 0 0 1-6.8 3.21H161.64a8.827 8.827 0 1 1 0-17.645h22.704a8.807 8.807 0 0 1 7.948 12.625zm44.334 35.496a8.817 8.817 0 0 1-12.418.673l-16.89-15.16a8.827 8.827 0 0 1-2.07-10.35q.57-.828 1.036-1.697c.103-.125.196-.26.31-.384a8.838 8.838 0 0 1 12.42-.672l16.898 15.17a8.817 8.817 0 0 1 .766 12.42zm53.202 8.486a8.765 8.765 0 0 1-5.175 4.397l-21.493 7.058a8.827 8.827 0 1 1-5.484-16.775l21.587-7.048a8.827 8.827 0 0 1 10.607 12.377zm36.416-42.513L314.82 74.83A8.827 8.827 0 0 1 299.533 66l11.383-19.662a8.843 8.843 0 1 1 15.327 8.827z',
	headshots: 'M324.55 177A69 69 0 0 1 264 238v-29a40.7 40.7 0 0 1-16 .05v29a69.25 69.25 0 0 1-60.84-61h29a40.59 40.59 0 0 1 .1-16h-29.1A69.67 69.67 0 0 1 248 100.58v29a40.7 40.7 0 0 1 16 .05v-29c32 3.68 56.87 29.42 60.55 60.42h-29.07a40.59 40.59 0 0 1 .1 16h29zm120.31 79c0 131.42-84.72 238.33-188.86 238.33-104.14 0-188.86-106.91-188.86-238.33 0-131.42 84.72-238.33 188.86-238.33 104.14 0 188.86 106.91 188.86 238.33zm-228.7 39.53c0-10.7-17.85-19.38-39.87-19.38-22.02 0-39.87 8.68-39.87 19.38s17.85 19.38 39.87 19.38c22.02 0 39.87-8.67 39.87-19.38zM264 254.06A85.59 85.59 0 0 0 340.64 177H364v-16h-23.36C336.84 121 304 88.29 264 84.49V64h-16v20.49A85.35 85.35 0 0 0 171.07 161H146v16h25.07A85 85 0 0 0 248 254.06V273h16v-18.94zm112.83 41.48c0-10.7-17.85-19.38-39.87-19.38-22.02 0-39.87 8.68-39.87 19.38s17.85 19.38 39.87 19.38c22.02 0 39.87-8.68 39.87-19.39z',
	map: 'M227.4 34.7c-10.1 0-20.2.2-30.2.5l6.1 65.6-61.1-62.5c-31.3 2.5-62.5 6.6-93.8 12.5l34.2 28.4-48-.6c35.1 100.2 6.9 182.6-.3 292.1L130 476.5c10-1.3 19.9-2.4 29.6-3.3l21.5-42.2 18.6 28.8 41.5-33.5.8 43c82.9-.2 157.7 9.1 235.7 7.9-28.2-73-31.2-143.6-31.9-209.2l-33.3-19.1 32.7-33.9c-.4-21.3-1.3-42-3.6-61.9l-57.4.7 50.2-41.7c-3.8-15.5-9-30.4-16.1-44.7l-29.5-23.9C335 38 281.2 34.6 227.4 34.7zm58.7 37c10.6 24.75 21.1 49.5 31.7 74.3 7.5-10.5 14.9-21 22.4-31.5 16 27.2 32 54.3 48 81.5l-16.2 9.5-33.3-56.7-42.5 59.4-15.2-10.9 24-33.5-21.9-51.5-24.6 40.1 12 22.6-16.5 8.8-18.3-34.5-24.8 58.2-17.2-7.4 32.5-76.2 7.7-18c4.8 9.2 9.6 18.3 14.5 27.4 12.5-20.6 25.1-41.11 37.7-61.6zM91.2 128c6.72 1.6 13.4 3.4 19.2 5.3-2.1 5.9-4.1 11.8-6.2 17.6-5.79-1.6-11.72-3.4-16.9-4.7 1.39-6 2.62-12.1 3.9-18.2zm37.9 13.4c6.3 3.8 12 7.2 17 12.8L132.6 167c-4-3.7-8.6-7-12.8-9.4zm28.7 32.3c2.1 7.4 2.1 15.7 1.6 22.5l-18.5-2.4c.1-5.1.3-10-1-14.5zm-21.2 35.7l17.2 7.1c-3.3 6.6-5.1 12.7-8.6 17.8l-16.3-9c2.6-5.4 5.6-10.8 7.7-15.9zm-16.5 34.1l17.7 6.1c-1.5 5.4-3 11.2-3.6 16.2l-18.6-2c1.3-7.5 2.1-14 4.5-20.3zm207.8 17.4c8.5 1 14.6 3 21.7 7.1l-9.8 16c-4.1-2.8-9.4-3.8-13.5-4.5zm-21.2 1.5c1.1 6.1 2.5 12.2 3.9 18.3-5.9 1.3-11.7 3.3-16.5 5.1l-6.8-17.4c6.7-2.4 13.5-4.7 19.4-6zm-37.9 15.9l11 15.1c-5.6 4-11.8 7.8-16.8 10.6l-8.9-16.4c5.1-2.9 10.6-6.3 14.7-9.3zM135.3 281c1.5 4.7 4.2 9.2 6.9 12.1l-13.8 12.6c-5.5-5.7-9.5-13.5-11.2-20.1zm230.3 3.3c3.5 6.4 6.8 12.7 8.7 19.1l-17.8 5.6c-2-5.4-4.3-10.8-6.8-14.8zm-127.4 10.9l6.9 17.3c-6.4 2.7-12.9 4.8-18.6 6.5l-5-18c5.9-1.6 11.3-3.8 16.7-5.8zm-83.8 6.2c5.3 1.7 10.8 3.4 15.7 4.2-1.2 6.1-2 12.3-2.8 18.5-7-1-14.5-3.3-20.5-5.7zm50 3.5l2.8 18.5c-7.2 1.3-13.4 1.6-19.8 1.9l-.4-18.7c5.9-.2 11.6-.8 17.4-1.7zm174.5 18c1 6.4 1.6 12.9 2.2 19.3l-18.7 1.5c-.4-6-.9-11.9-2-17.8zm-67.6 30.8c18.9 3.5 44.9 16.2 68.9 33.9 7.4-9.9 14.4-20.4 21.3-31.1l30.1 12.9c-4.7 12.3-15 25.6-28.6 37.2 17 16.2 30.9 34.5 37 53-13.8-18.1-31.1-31.8-50.3-42.8-23.4 15.8-52.7 25.9-79.6 20.4 22.9-4.4 40.6-16.6 55.8-32.6-16.5-7.5-33.8-13.9-51.3-20.1z',
	deadliest: 'M128 73c-25.495 0-44.07 6.4-55.97 13.86C60.134 94.32 56 103.84 56 104.63v40.274c6.343 2.532 12.03 5.422 17.023 8.545C89.79 163.94 100 175.957 100 189.542v59.57c8.63-1.35 17.956-2.113 28-2.113s19.37.764 28 2.113v-59.57c0-13.585 10.21-25.604 26.977-36.094 4.992-3.124 10.68-6.014 17.023-8.546V104.63c0-.792-4.133-10.31-16.03-17.77C172.07 79.4 153.494 73 128 73zm256 0c-25.495 0-44.07 6.4-55.97 13.86C316.134 94.32 312 103.84 312 104.63v40.274c6.343 2.532 12.03 5.422 17.023 8.545C345.79 163.94 356 175.957 356 189.542v59.57c8.63-1.35 17.956-2.113 28-2.113s19.37.764 28 2.113v-59.57c0-13.585 10.21-25.604 26.977-36.094 4.992-3.124 10.68-6.014 17.023-8.546V104.63c0-.792-4.133-10.31-16.03-17.77C428.07 79.4 409.494 73 384 73zM119 91.086h18v31.63h45v18h-45v99.34h-18v-99.34H74v-18h45v-31.63zm256 0h18v31.63h45v18h-45v99.34h-18v-99.34h-45v-18h45v-31.63zM256 153c-28.832 0-49.91 7.222-63.477 15.71C178.958 177.195 174 187.946 174 189.542v63.494c12.076 3.43 22.355 8.07 30.77 13.33C222.37 277.367 233 290 233 304v58.715h46V304c0-14 10.63-26.632 28.23-37.633 8.415-5.26 18.694-9.9 30.77-13.33v-63.494c0-1.596-4.958-12.347-18.523-20.834C305.91 160.22 284.832 153 256 153zm-238 1.016v56.888h42.666v18H18v133.81h5V304c0-14 10.63-26.632 28.23-37.633 8.415-5.26 18.694-9.9 30.77-13.33v-63.494c0-1.596-4.958-12.347-18.523-20.834C52.917 162.1 37.78 156.28 18 154.015zm476 0c-19.78 2.263-34.916 8.086-45.477 14.693C434.958 177.195 430 187.946 430 189.542v63.494c12.076 3.43 22.355 8.07 30.77 13.33C478.37 277.367 489 290 489 304v58.715h5v-133.81h-42.666v-18H494v-56.89zM247 174.36h18v36.544h51.666v18H265v112.448h-18V228.904h-51.666v-18H247V174.36zM128 265c-30.5 0-52.83 7.633-67.23 16.633C46.37 290.633 41 302 41 304v183h174V304c0-2-5.37-13.368-19.77-22.367-14.4-9-36.73-16.633-67.23-16.633zm256 0c-30.5 0-52.83 7.633-67.23 16.633C302.37 290.633 297 302 297 304v183h174V304c0-2-5.37-13.368-19.77-22.367-14.4-9-36.73-16.633-67.23-16.633zm-265 23h18v39h55v18h-55v119h-18V345H64v-18h55v-39zm256 0h18v39h55v18h-55v119h-18V345h-55v-18h55v-39z',
	survived: 'M259.375 16.25c-132.32 0-239.78 107.46-239.78 239.78s107.46 239.783 239.78 239.783 239.78-107.462 239.78-239.782-107.46-239.78-239.78-239.78zm33.5 20.406c26.563 4.015 51.57 12.708 74.156 25.25L308.907 209.03c-14.573-7.215-30.96-11.344-48.312-11.53l32.28-160.844zm-67.72.094l23.97 161.22c-17.2 1.56-33.28 6.986-47.313 15.436l-51-151c22.616-12.698 47.696-21.54 74.344-25.656zm193.25 64.5c17.683 18.164 32.28 39.32 42.94 62.688l-107.658 85.468c-8.9-14.076-20.863-26.014-34.968-34.875l99.686-113.28zm-319.092 1.063L192.5 219.686c-13.318 9.978-24.317 22.88-32.063 37.75L56.5 166c10.527-23.725 25.082-45.226 42.813-63.688zm378.75 115.906c2.105 12.286 3.218 24.92 3.218 37.81 0 11.49-.882 22.768-2.56 33.783l-107.876 16.062c-.463-17.028-4.757-33.097-12-47.375l119.22-40.28zM40.25 221.093l115.844 45.75c-4.918 12.077-7.81 25.224-8.188 39l-107.844-16.03c-1.678-11.016-2.562-22.295-2.562-33.783 0-11.89.954-23.554 2.75-34.936zm130.563 89.53h177.125L467 334.532c-31.674 83.843-112.62 143.376-207.625 143.376-95.018 0-175.968-59.548-207.625-143.406l119.063-23.875z',
	outbreak: 'M259.646 33.586c-44.698 10.116-96.576 26.075-141.98 42.926-42.563 15.796-79.721 32.796-97.816 44.22l28.634 40.006C85.45 141.836 163.58 106.833 258.87 78.725c.115-12.307.426-26.651.777-45.14zm-.755 63.922c-89.553 26.838-163.813 59.876-199.809 78.035l11.363 15.877c64.955-26.867 129.99-52.813 189.244-73.865-.436-6.558-.686-13.057-.798-20.047zm10.861 35.584c-63.467 22.407-134.187 50.745-204.494 79.949l-.063-.148c-22.345 11.147-36.325 23.22-47.084 35.552 3.174.194 6.684.262 10.803-.04 11.524-.847 26.29-3.532 42.982-7.69 33.387-8.316 74.56-22.461 115.413-38.873 40.852-16.412 81.444-35.104 113.841-52.438 20.416-10.922 37.096-21.52 48.778-30.168-27.24-.104-57.425 6.306-80.176 13.856zm18.371 43.3a1084.226 1084.226 0 0 1-16.488 8.057c6.635 4.076 11.482 10.968 14.367 18.592 3.944 10.42 4.892 22.894 2.566 35.8-2.325 12.907-7.527 24.049-14.789 32.046s-17.434 13.233-28.275 10.888c-10.842-2.344-18.433-11.423-22.377-21.843-3.944-10.42-4.894-22.894-2.568-35.801 1.264-7.02 3.387-13.512 6.222-19.266a1358.468 1358.468 0 0 1-32.761 13.678 1248.826 1248.826 0 0 1-43.65 16.613c11.354 20.924 27.32 38.077 51.366 50.307l9.17 4.664-5.842 8.469c-8.506 12.333-6.783 30.624 1.875 43.974 8.659 13.35 21.871 20.897 38.64 14.395 59.434-23.047 104.228-28.81 145.775-21.113 34.839 6.454 67.127 22.398 103.834 43.81-12.425-28.256-33.968-57.384-60.729-82.209-33.985-31.525-76.04-56.09-116.33-64.65l-5.635-1.198-1.271-5.617c-.802-3.538-8.001-29.713-23.1-49.595zm-29.527 22.372c-2.798.11-6.202 1.744-9.908 5.826-4.563 5.024-8.733 13.374-10.53 23.348-1.796 9.973-.835 19.436 1.643 25.982 2.477 6.546 5.817 9.469 8.896 10.135 3.08.666 7.182-.646 11.744-5.67 4.563-5.024 8.735-13.377 10.532-23.35 1.796-9.973.833-19.436-1.645-25.982-2.478-6.547-5.817-9.469-8.896-10.135a7.293 7.293 0 0 0-1.836-.154zm-125.414 42.4c-18.266 6.199-35.82 11.553-51.98 15.748-4.18 24.009 9.737 55.444 19.53 71.184 36.172 26.058 68.19 52.072 126.23 70.021l-4.89-22.824c-12.567-3.576-23.285-12.214-30.234-22.93-10.383-16.01-14.055-37.249-6.25-55.41-23.92-14.166-40.703-33.554-52.406-55.789zm-56.55 92.08c-9.031 13.247-23.97 18.894-37.823 21.772 15.285 25.397 49.541 49.906 93.216 72.103 41.305 20.993 90.376 40.17 138.215 58.6-11.892-19.381-20.046-40.812-22.304-63.33-86.163-20.547-125.096-57.285-171.303-89.145zm-27.696 61.57C36.052 424.224 26.8 455.703 25.279 487h198.588c-34.824-13.775-69.286-28.225-99.998-43.834-29.2-14.84-55.252-30.589-74.933-48.352z',
	kills: 'M35.143 35.8c-5.796-.14-11.483 2.82-14.575 8.212-4.497 7.84-1.8 17.85 6.026 22.355 4.804 2.767 10.42 2.805 15.086.615l68.558 39.375-29.797 51.957 28.51 16.49c6.374-49.47 27.945-90.184 68.726-119.837l-28.51-16.492-29.63 51.67-68.522-39.352c-.44-5.166-3.31-10.04-8.135-12.818-2.446-1.408-5.103-2.113-7.737-2.176zm153.093 71.632l-37.892.642 251.484 144.74-9.322 16.198-253.45-145.87 19.89 35.135c3.916 1.873 29.888 14.392 59.775 33.858 30.715 20.005 64.022 44.997 74.397 74.703 4.567 2.27 31.488 15.496 69.58 27.764 37.96 12.224 84.088 21.654 119.912 15.58-12.992-35.507-44.6-70.15-74.456-95.995-27.686-23.965-52.14-39.656-59.117-43.998-30.91 5.99-69.19-10.66-101.86-27.53-31.63-16.333-55.295-32.69-58.94-35.228zm-26.992 72.9c5.623 17.433 10.356 39.574 14.51 64.59v77.287h18.687v-42.12c14.672-28.54 40.948-3.137 50.7 53.53v161.003h18.688V335.87c12.62-13.188 27.91 3.7 38.975 32.24v35.175h18.69v-25.707c17.057-20.727 46.446-5.688 59.93 49.102v66.888h18.688v-67.07c17.575-58.125 49.153-84.382 74.394-96.3-38.7 3.766-81.725-6.276-117.537-17.81-42.97-13.838-75.7-30.45-75.7-30.45l-3.72-1.887-1.078-4.027c-5.46-20.368-36.988-48.063-67.95-68.228-18.276-11.905-35.828-21.51-47.276-27.463zm23.854 181.48c-11.643 0-21.08 9.438-21.08 21.08 0 11.644 9.437 21.08 21.08 21.08 11.643 0 21.08-9.436 21.08-21.08 0-11.642-9.437-21.08-21.08-21.08zm283.754 7.53s-21.08 52.667-21.08 64.31 9.437 21.08 21.08 21.08c11.643 0 21.08-9.437 21.08-21.08 0-11.643-21.08-64.31-21.08-64.31zM312.15 426.11c-11.643 0-21.082 9.436-21.082 21.08 0 11.642 9.44 21.08 21.082 21.08 11.643 0 21.08-9.438 21.08-21.08 0-11.644-9.437-21.08-21.08-21.08z',
	night: 'M253.813 15.625c-132.32 0-239.782 107.46-239.782 239.78s107.463 239.782 239.782 239.782c132.32 0 239.782-107.46 239.782-239.78S386.132 15.624 253.814 15.624zm0 17.906c122.653 0 221.906 99.223 221.906 221.876 0 30.738-6.26 59.99-17.533 86.594l-42.343-34.72c-49.613 13.98-110.337 9.033-138.906-60.874l-41.97 152.938c-8.837-45.53-23.35-81.28-47.905-115.22-19.71 13.855-32.352 32.63-39.72 50.97L88.94 237.03c-17.85 27.32-33.77 56.565-45.032 90.47-7.744-22.6-11.968-46.852-11.968-72.094 0-26.013 4.484-50.973 12.687-74.156 2.752 6.608 9.27 11.25 16.875 11.25 10.093 0 18.28-8.157 18.28-18.25s-8.187-18.28-18.28-18.28c-2.385 0-4.66.48-6.75 1.31 27.537-55.83 77.83-98.368 138.844-115.5-.558 1.938-.844 3.98-.844 6.095 0 12.146 9.823 22 21.97 22 12.144 0 22-9.854 22-22 0-4.99-1.67-9.59-4.47-13.28 7.092-.683 14.29-1.064 21.563-1.064zm18.75 27.657c-6.444 0-11.657 5.213-11.657 11.657 0 6.443 5.213 11.687 11.656 11.687 6.444 0 11.688-5.243 11.688-11.686 0-6.444-5.244-11.656-11.688-11.656zM198.03 90.22c-6.02.06-12.132.868-18.218 2.5-38.945 10.434-62.06 50.46-51.625 89.405 10.436 38.946 50.463 62.06 89.407 51.625 21.712-5.818 38.48-20.85 47.28-39.75-6.835 7.36-15.737 12.958-26.155 15.75-29.504 7.905-59.846-9.59-67.75-39.094-7.907-29.504 9.62-59.813 39.124-67.72 10.41-2.788 20.906-2.417 30.5.533-12.28-8.598-27.116-13.405-42.563-13.25zm155.282.81c-9.408 0-17.03 7.624-17.03 17.032 0 9.41 7.622 17.032 17.03 17.032 9.41 0 17.032-7.623 17.032-17.03 0-9.41-7.623-17.033-17.03-17.033zm-248.937 27.376c-6.443 0-11.656 5.244-11.656 11.688 0 6.443 5.212 11.656 11.655 11.656s11.656-5.213 11.656-11.656c0-6.444-5.212-11.688-11.655-11.688zm275.688 40.813l-.625 29.843-28.22 9.812 28.22 9.813.625 29.843 18.03-23.78 28.563 8.625-17.03-24.5 17.03-24.53L398.094 183l-18.03-23.78zm-72.094 11.593c-6.445 0-11.658 5.212-11.658 11.656 0 6.442 5.213 11.686 11.657 11.686 6.442 0 11.686-5.244 11.686-11.687 0-6.445-5.244-11.657-11.687-11.657zm139 74.75c-6.445 0-11.658 5.244-11.658 11.687s5.213 11.656 11.657 11.656c6.442 0 11.686-5.213 11.686-11.656 0-6.443-5.244-11.688-11.687-11.688zm-127.314 3.5c-6.443 0-11.656 5.244-11.656 11.687s5.213 11.656 11.656 11.656c6.444 0 11.656-5.213 11.656-11.656 0-6.443-5.212-11.688-11.656-11.688z',
	held: 'M151 32v247h18V32h-18zm247 9.574l-13.428 7.59c-31.626 17.876-61.492 12.267-93.138 4.356-31.647-7.912-64.83-18.84-97.946-4.807L188 51.039V166.588l12.512-5.3c25.883-10.968 54.201-2.396 86.554 5.692 32.354 8.089 68.988 14.98 106.362-6.144l4.572-2.584V41.574zM73 297v67.271l32 32V487h302v-90.729l32-32V297h-46v39h-18v-39h-46v39h-18v-39h-46v39h-18v-39h-46v39h-18v-39h-46v39h-18v-39H73z',
	overrun: 'M63.648 18.836l-21.906 5.22 4.174 17.508 21.904-5.22-4.172-17.508zm55.41 9.576c-10.812.018-19.293 3.666-24.505 10.344-5.56 7.123-6.867 17.012-3.494 28.383 3.372 11.37 11.602 23.646 23.973 33.288 12.372 9.64 26.29 14.625 38.15 15.125 11.856.5 21.136-3.178 26.696-10.3 5.56-7.124 6.866-17.012 3.493-28.382a50.804 50.804 0 0 0-1.172-3.434c-8.79 6.754-14.632 18.57-22.014 13.644-2.02-1.347 4.205-17.284 13.49-28.98a75.225 75.225 0 0 0-9.41-10.39l-25.328 12.17-13.696-12.644c2.028-1.745 18.215-4.463 31.54-5.603-11.69-8.362-24.503-12.712-35.532-13.176a50.13 50.13 0 0 0-2.193-.045zm135.215 11.375l-21.128 7.79 6.226 16.888 21.13-7.79-6.227-16.888zm52.932 22.277l-13.496 11.91 14.897 16.883 13.498-11.908-14.9-16.886zm-265.8 24.73L25.81 95.788l11.25 19.506 15.592-8.992-11.25-19.505zm155.54 25.33a41.26 41.26 0 0 1-2.867 4.192c-9.75 12.493-25.473 17.895-41.658 17.213-5.973-.252-12.08-1.295-18.166-3.096-.692 8.702-.662 17.523-.018 26.373l7.3-3.37.5 16.885 12.91 2.485-7.448 14.898 17.38 15.395-16.388 6.457 8.444 9.435-6.967 6.45c10.697 28.977 25.217 55.522 39.002 75.956 16.78 24.877 33.407 70.446 34.106 98.352l-37.594 95.297 113.575 1.187.793-20.564-7.577-1.32-12.673 12.322-10.43-8.94h-8.94l-1.312-9.193-21.28-3.708 28.37-63.31c1.334-37.238-10.187-63.18-18.72-100.418 17.34 11.887 34.13 23.517 50.22 35.474 3.39-3.158 7.75-5.67 14.87-6.342 4.78 7.99 5.047 14.693 4.413 21.137 25.186 20.06 48.29 41.65 68.536 67.356l55.403-96.488-16.375-9.064-45.36 43.074c-25.322-34.38-62.046-59.99-101.895-88.56-3.014-9.555-7.292-18.512-12.196-27.055-3.357 4.796-7.873 9.123-11.627 12.125-7.314 5.85-20.288 2.142-23.34-3.973-3.05-6.116 11.094-9.658 7.946-15.395-3.148-5.738-17.153 3.158-21.852-1.987-4.697-5.145-6.025-13.1 0-19.865 3.768-4.228 12.42-6.017 20.75-5.955a54.94 54.94 0 0 1 4.968.266c-8.813-12.567-16.915-24.728-21.516-37.208 29.466 3.21 58.927 6.432 86.832 17.442 5.666 15.217 1.188 30.435-4.916 45.652 4.516.913 9.738 1.007 14.41-5.498 12.134-16.9 20.338-37.936 14.387-58.414-1.382-4.756-40.025-14.216-77.795-22.226 27.81-3.497 57.99-5.808 89.506-7.452 14.352 4.97 21.266 19.44 21.828 40.266 15.58-7.543 19.9-15.453 20.506-26.77.937-17.48-12.432-32.673-21.85-35.517-3.76-1.24-137.436.263-166.195-4.005zM427.02 136.34l-17.315 14.394 11.508 13.842 17.314-14.396-11.506-13.84zm-343.145 4.61l-5.457 17.154 21.46 6.828 5.456-17.155-21.46-6.826zm318.168 123.564l-16.05 15.793 12.622 12.832 16.053-15.794-12.625-12.832zm-258.078 29.894l-5.455 17.153 21.46 6.827 5.454-17.153-21.46-6.826z',
};


function glyph(key, ink, ring = false) {
	return h('span', { class: ring ? 'honor-icon' : 'glyph', style: `--ink: var(--${ink})`, 'aria-hidden': 'true' },
		svg('svg', { viewBox: '0 0 512 512' }, svg('path', { d: REPORT_ICONS[key] })));
}


const legend = (...items) => h('ul', { class: 'key' }, items.filter(Boolean).map(([ink, text]) => h('li', {}, h('span', { class: 'swatch', style: `--ink: var(--${ink})` }), text)));


// Redraws at the container's width so chart text keeps its real size.
function plot(label, draw) {
	const figure = h('figure', { class: 'plot' });
	let drawn = 0;
	new ResizeObserver(([entry]) => {
		const width = Math.floor(entry.contentRect.width);
		if (!width || width === drawn) return;
		drawn = width;
		requestAnimationFrame(() => {
			const [height, marks] = draw(width);
			figure.replaceChildren(svg('svg', { role: 'img', 'aria-label': label, width, height, viewBox: `0 0 ${width} ${height}` }, marks));
		});
	}).observe(figure);
	return figure;
}


function barPath(x, y, width, height, round) {
	const r = round ? Math.min(4, width, height / 2) : 0;
	return `M${x.toFixed(1)} ${y}h${(width - r).toFixed(1)}a${r} ${r} 0 0 1 ${r} ${r}v${height - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${(r - width).toFixed(1)}z`;
}


function barRow(y, width, name, title, parts, scale, ...extra) {
	const last = parts.findLastIndex((part) => part.value > 0);
	let x = 0;
	const bars = parts.map((part, i) => {
		if (!part.value) return null;
		const d = barPath(x, y + 24, Math.max(1, part.value * scale - (i < last ? 2 : 0)), 12, i === last);
		x += part.value * scale;
		return svg('path', { d, style: `fill: var(--${part.ink})` });
	});
	return svg('g', { class: 'row' },
		svg('title', {}, title),
		svg('rect', { class: 'hit', y, width, height: 50 }),
		svg('text', { x: 0, y: y + 15 }, name),
		bars,
		svg('text', { class: 'num', x: (x + 8).toFixed(1), y: y + 36 }, number(parts.reduce((sum, part) => sum + part.value, 0))),
		extra);
}


function roundsChart(winners) {
	const sides = { h: ['brass', 'humans held'], z: ['slime', 'zombies won'], '-': ['none', 'no winner'] };
	return plot(`${plural(winners.length, 'round')} in the order fought: ${[...winners].map((w) => sides[w][1]).join(', ')}`, (width) => {
		const gap = 4;
		const cell = Math.max(14, Math.min(28, Math.floor((width + gap) / winners.length) - gap));
		const cols = Math.max(1, Math.floor((width + gap) / (cell + gap)));
		return [Math.ceil(winners.length / cols) * (cell + gap) - gap, [...winners].map((w, i) => svg('rect', {
			class: 'tile', x: (i % cols) * (cell + gap), y: Math.floor(i / cols) * (cell + gap), width: cell, height: cell, rx: 2, style: `fill: var(--${sides[w][0]})`,
		}, svg('title', {}, `Round ${i + 1}: ${sides[w][1]}`)))];
	});
}


function mapsChart(maps) {
	const lost = (m) => m.human_deaths / m.rounds;
	const describe = (m) => `${prettyMap(m.map)}: ${plural(m.rounds, 'round')}, humans held ${number(m.human_wins)}, zombies won ${number(m.zombie_wins)}, ${lost(m).toFixed(1)} humans lost a round`;
	return plot(`Rounds per map. ${maps.map(describe).join('; ')}`, (width) => {
		const gap = width < 560 ? 24 : 64;
		const split = Math.round((width - gap) * 0.6);
		const left = split + gap;
		const reach = width - left - 44;
		const scale = (split - 36) / Math.max(...maps.map((m) => m.rounds));
		const worst = Math.max(...maps.map(lost)) || 1;
		return [36 + maps.length * 50, [
			svg('text', { class: 'head', x: 0, y: 14 }, 'Rounds, by who won'),
			svg('text', { class: 'head', x: left, y: 14 }, width < 560 ? 'Lost a round' : 'Humans lost a round'),
			maps.map((m, i) => {
				const y = 36 + i * 50;
				const dot = (left + (lost(m) / worst) * reach).toFixed(1);
				return barRow(y, width, prettyMap(m.map), describe(m),
					[{ value: m.human_wins, ink: 'brass' }, { value: m.zombie_wins, ink: 'slime' }, { value: m.rounds - m.human_wins - m.zombie_wins, ink: 'none' }], scale,
					svg('line', { class: 'track', x1: left, x2: left + reach, y1: y + 30, y2: y + 30 }),
					svg('line', { class: 'stem', x1: left, x2: dot, y1: y + 30, y2: y + 30 }),
					svg('circle', { class: 'dot', cx: dot, cy: y + 30, r: 5 }),
					svg('text', { class: 'num', x: (Number(dot) + 12).toFixed(1), y: y + 36 }, lost(m).toFixed(1)));
			}),
		]];
	});
}


function weaponsChart(weapons) {
	const describe = (w) => `${prettyWeapon(w.weapon)}: ${plural(w.kills, 'kill')}, ${plural(w.headshots, 'headshot')}`;
	return plot(`Zombies killed by human weapon. ${weapons.map(describe).join('; ')}`, (width) => {
		const scale = (width - 48) / Math.max(...weapons.map((w) => w.kills));
		return [weapons.length * 50, weapons.map((w, i) => barRow(i * 50, width, prettyWeapon(w.weapon), describe(w),
			[{ value: w.headshots, ink: 'scarlet' }, { value: w.kills - w.headshots, ink: 'brass' }], scale))];
	});
}


// A 24 hour clock face, midnight at the top, one wedge per hour of local time.
function hoursChart(hours, hourLabel) {
	const peak = Math.max(1, ...hours);
	const busiest = hours.indexOf(peak);
	return plot(`Kills by hour of day in your local time. ${hours.map((count, hour) => `${hourLabel(hour)} ${number(count)}`).join(', ')}`, (width) => {
		const size = Math.min(width, 440);
		const c = size / 2;
		const outer = c - 46;
		const inner = outer * 0.4;
		const at = (hour, r) => [c + r * Math.cos((hour / 12 - 0.5) * Math.PI), c + r * Math.sin((hour / 12 - 0.5) * Math.PI)];
		const xy = (hour, r) => at(hour, r).map((n) => n.toFixed(1)).join(' ');
		const wedge = (hour, r) => `M${xy(hour + 0.08, inner)}A${inner} ${inner} 0 0 1 ${xy(hour + 0.92, inner)}L${xy(hour + 0.92, r)}A${r} ${r} 0 0 0 ${xy(hour + 0.08, r)}Z`;
		return [size, [
			svg('image', { class: 'clock-moon', href: 'moon.webp', x: c - inner + 6, y: c - inner + 6, width: 2 * inner - 12, height: 2 * inner - 12 }),
			svg('circle', { class: 'grid', cx: c, cy: c, r: inner }),
			svg('circle', { class: 'grid', cx: c, cy: c, r: outer }),
			[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => {
				const [x, y] = at(hour, outer + 24);
				return [svg('path', { class: 'grid', d: `M${xy(hour, inner)}L${xy(hour, outer)}` }), svg('text', { class: 'tick', x: x.toFixed(1), y: y.toFixed(1) }, hourLabel(hour))];
			}),
			hours.map((count, hour) => count > 0 && svg('path', { class: hour === busiest ? 'hour peak' : 'hour', d: wedge(hour, inner + (count / peak) * (outer - inner)) },
				svg('title', {}, `${hourLabel(hour)}: ${plural(count, 'kill')}`))),
		]];
	});
}


async function reportPage() {
	const slug = new URLSearchParams(location.search).get('event');
	let meta;
	let data;
	try {
		meta = await getJSON('data/meta.json');
		data = await getJSON(slug ? `data/events/${encodeURIComponent(slug)}.json` : 'data/all-time.json');
	} catch {
		$('#report').replaceChildren(h('section', { class: 'results' },
			h('h1', {}, 'No results yet'),
			h('p', { class: 'note' }, 'The report fills in after the first outbreak.')));
		return;
	}
	dispatch(meta);
	const event = meta.events.find((e) => e.slug === slug);
	const started = meta.events.filter((e) => Date.parse(e.start) / 1000 <= meta.snapshot_at);
	const s = data.summary;
	const decided = s.human_wins + s.zombie_wins;
	const offset = Math.round(-new Date().getTimezoneOffset() / 60);
	const localHours = Array.from({ length: 24 }, (_, hour) => s.kills_by_hour_utc[(((hour - offset) % 24) + 24) % 24] || 0);
	const busiest = localHours.indexOf(Math.max(...localHours));
	const deadliest = s.maps.find((m) => m.map === s.deadliest_map);
	const hourLabel = (hour) => new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' });
	const tallies = [
		['Humans fallen', s.human_lives_lost, 'scarlet', 'fallen'],
		['Zombies put down', s.zombies_defeated, 'slime', 'put_down'],
		['Rounds fought', s.rounds, 'brass', 'rounds'],
		['Players', s.players, 'brass', 'players'],
		['Hours played', s.hours_played, 'brass', 'hours'],
		['Headshots', s.headshots, 'scarlet', 'headshots'],
	].map(([label, value, ink, icon]) => ({ label, value, ink, icon, node: h('span', {}, '0') }));
	const fact = (icon, ink, label, value) => h('li', {}, leader([glyph(icon, ink), h('span', { class: 'label' }, label)], value));
	const side = (count, ink, icon, text) => h('li', { style: `--ink: var(--${ink})` }, glyph(icon, ink, true), h('strong', {}, number(count)), ` ${count === 1 ? 'round' : 'rounds'} ${text}`);

	$('#report').replaceChildren(
		h('section', { class: 'results' },
			h('div', { class: 'sky', 'aria-hidden': 'true' },
				h('img', { class: 'wash', src: 'moon.webp', alt: '' }),
				h('img', { class: 'sky-moon', src: 'moon.webp', alt: '', width: 1100, height: 1100 })),
			h('h1', {}, event ? event.name : 'All time'),
			event && h('p', { class: 'note' }, `${new Date(event.start).toLocaleDateString()} to ${new Date(event.end).toLocaleDateString()}`),
			event && !event.ended && h('span', { class: 'status blink' }, 'In progress'),
			h('nav', { class: 'stages-nav', 'aria-label': 'Reports' },
				h('a', { href: 'infographic.html', 'aria-current': slug ? false : 'page' }, 'All time'),
				started.map((e) => h('a', { href: `infographic.html?event=${encodeURIComponent(e.slug)}`, 'aria-current': e.slug === slug ? 'page' : false }, e.name)))),
		h('div', { class: 'ledgers' },
			h('ul', { class: 'tally-list', 'aria-label': 'Totals' }, tallies.map((t) => h('li', { style: `--ink: var(--${t.ink})` },
				leader([glyph(t.icon, t.ink, true), h('span', { class: 'label' }, t.label)], t.node))))),
		s.rounds > 0 && h('section', {},
			h('h2', {}, 'Who won'),
			h('ul', { class: 'sides' },
				side(s.human_wins, 'brass', 'held', 'held by the humans'),
				side(s.zombie_wins, 'slime', 'overrun', 'overrun by the zombies')),
			roundsChart(s.winners),
			h('p', { class: 'note' }, 'Every round in the order it was fought.', decided < s.rounds ? ` ${plural(s.rounds - decided, 'round')} ended without a winner.` : '')),
		h('section', {},
			h('h2', {}, 'Field notes'),
			h('ul', { class: 'facts' },
				fact('map', 'brass', 'Most played map', s.maps[0] ? prettyMap(s.maps[0].map) : 'None yet'),
				fact('deadliest', 'scarlet', 'Deadliest map', deadliest ? `${prettyMap(deadliest.map)}, ${(deadliest.human_deaths / deadliest.rounds).toFixed(1)} lost a round` : 'None yet'),
				fact('survived', 'brass', 'Humans who survived', `${Math.round(s.survival_rate * 100)}%`),
				fact('outbreak', 'slime', 'Outbreaks started', number(s.outbreaks)),
				fact('kills', 'scarlet', 'Kills', number(s.kills)),
				fact('night', 'brass', 'Busiest hour', s.kills ? hourLabel(busiest) : 'None yet'))),
		s.maps.length > 0 && h('div', { class: 'ledgers' },
			h('section', {},
				h('h2', {}, 'Rounds per map'),
				legend(['brass', 'Humans held'], ['slime', 'Zombies won'], decided < s.rounds && ['none', 'No winner']),
				mapsChart(s.maps)),
			h('div', { class: 'pair' },
				s.human_weapons.length > 0 && h('section', {},
					h('h2', {}, 'Human weapons'),
					legend(['scarlet', 'Headshots'], ['brass', 'Other kills']),
					weaponsChart(s.human_weapons)),
				s.kills > 0 && h('section', {},
					h('h2', {}, 'When the killing happens'),
					hoursChart(localHours, hourLabel),
					h('p', { class: 'note' }, `Kills by hour of day in your local time, busiest at ${hourLabel(busiest)} with ${plural(localHours[busiest], 'kill')}.`)))),
		h('section', {},
			h('h2', {}, event && event.ended ? 'Final honors' : 'Honors so far'),
			h('ul', { class: 'hall' }, data.honors.map(honorItem))),
	);
	for (const t of tallies) tally(t.node, t.value);
}

const pages = { roll: rollPage, player: playerPage, report: reportPage };
pages[document.body.dataset.page]?.();
