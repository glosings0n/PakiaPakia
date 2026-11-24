import { ITEMS } from '../../shared/items';
import type { ItemId } from '../../shared/types';

/**
 * Hand-drawn grocery illustrations as SVG strings, so the same art can be used by
 * React (game) and by the dependency-free splash card. 100 units = 1 bag cell.
 */

const INK = '#2b2622';
const S = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const S4 = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const S3 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const label = (
  x: number,
  y: number,
  size: number,
  color: string,
  text: string
) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="700" fill="${color}" text-anchor="middle">${text}</text>`;
const steam = (x: number, y: number, color = '#e0702e') =>
  `<path d="M${x} ${y} q-6 -6 0 -12 q6 -6 0 -12" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;

const ART: Record<ItemId, string> = {
  watermelon: `
    <ellipse cx="100" cy="108" rx="86" ry="80" fill="#4e9a47"/>
    <path d="M100 30 C72 62 72 152 100 186 M58 40 C36 74 36 142 60 176 M142 40 C164 74 164 142 140 176" fill="none" stroke="#2f6a30" stroke-width="13" stroke-linecap="round"/>
    <path d="M44 78 Q54 54 80 44" fill="none" stroke="#bfe3a8" stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="100" cy="108" rx="86" ry="80" fill="none" ${S}/>
    <path d="M100 28 q4 -14 18 -16" fill="none" ${S}/>`,
  turkey: `
    <path d="M52 74 L26 44" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>
    <path d="M148 74 L174 44" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>
    <path d="M52 74 L26 44" stroke="#e7b98a" stroke-width="20" stroke-linecap="round"/>
    <path d="M148 74 L174 44" stroke="#e7b98a" stroke-width="20" stroke-linecap="round"/>
    <circle cx="22" cy="38" r="11" fill="#fff3e0" ${S4}/>
    <circle cx="178" cy="38" r="11" fill="#fff3e0" ${S4}/>
    <path d="M28 124 C28 76 66 56 100 56 C136 56 174 76 172 124 C170 164 136 182 100 182 C62 182 28 164 28 124 Z" fill="#e7b98a" ${S}/>
    <path d="M56 98 Q76 78 104 76" fill="none" stroke="#f6dcbc" stroke-width="9" stroke-linecap="round"/>
    <rect x="16" y="30" width="168" height="160" rx="36" fill="#cfe8f7" opacity="0.45" stroke="#6fa8d0" stroke-width="4" stroke-dasharray="10 8"/>
    <rect x="52" y="112" width="96" height="34" rx="7" fill="#ffffff" ${S4}/>
    ${label(100, 136, 19, '#2f7fc1', 'Frozen')}`,
  pizza: `
    ${steam(66, 26)}${steam(100, 26)}${steam(134, 26)}
    <rect x="14" y="30" width="172" height="156" rx="12" fill="#f3dfb8" ${S}/>
    <line x1="14" y1="58" x2="186" y2="58" ${S4}/>
    <circle cx="100" cy="120" r="46" fill="#d9452b" ${S}/>
    <circle cx="100" cy="120" r="34" fill="none" stroke="#f6a77c" stroke-width="4" stroke-dasharray="6 7"/>
    ${label(100, 128, 22, '#fff3e0', 'Pizza')}`,
  cake: `
    <rect x="12" y="170" width="176" height="16" rx="8" fill="#e8e1d4" ${S4}/>
    <rect x="26" y="110" width="148" height="62" rx="10" fill="#f5b3c3" ${S}/>
    <path d="M30 122 q11 16 22 0 q11 16 22 0 q11 16 22 0 q11 16 22 0 q11 16 22 0 q11 16 22 0" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
    <rect x="52" y="64" width="96" height="50" rx="10" fill="#f9d3dc" ${S}/>
    <path d="M56 76 q10 12 20 0 q10 12 20 0 q10 12 20 0 q10 12 20 0" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
    <rect x="74" y="38" width="9" height="26" rx="2" fill="#7fb6db" ${S3}/>
    <rect x="96" y="38" width="9" height="26" rx="2" fill="#f08a3c" ${S3}/>
    <rect x="118" y="38" width="9" height="26" rx="2" fill="#7fb6db" ${S3}/>
    <path d="M78 34 q-5 -8 0 -14 q5 6 0 14Z M100 34 q-5 -8 0 -14 q5 6 0 14Z M122 34 q-5 -8 0 -14 q5 6 0 14Z" fill="#f7c948" ${S3}/>`,
  water: `
    ${[0, 1, 2, 3]
      .map((i) => {
        const x = 14 + i * 44;
        return `<rect x="${x + 11}" y="10" width="16" height="16" rx="3" fill="#2f7fc1" ${S3}/>
        <rect x="${x}" y="24" width="38" height="66" rx="11" fill="#a9d6f2" ${S4}/>
        <rect x="${x + 2}" y="48" width="34" height="18" fill="#2f7fc1"/>`;
      })
      .join('')}
    <rect x="8" y="42" width="184" height="30" rx="6" fill="#ffffff" opacity="0.35" ${S3}/>`,
  rice: `
    <path d="M18 42 Q14 30 28 28 L72 28 Q86 30 82 42 L88 176 Q88 190 74 190 L26 190 Q12 190 12 176 Z" fill="#efe4cc" ${S}/>
    <path d="M30 30 Q50 12 70 30" fill="none" ${S4}/>
    <rect x="30" y="36" width="40" height="9" rx="4" fill="#b5703c" ${S3}/>
    <rect x="20" y="92" width="60" height="46" rx="7" fill="#d9452b" ${S4}/>
    ${label(50, 122, 19, '#ffffff', 'Rice')}
    <path d="M30 160 l6 -3 M48 166 l6 -3 M64 158 l6 -3 M40 176 l6 -3" stroke="#c8b48c" stroke-width="4" stroke-linecap="round"/>`,
  soup: `
    <rect x="20" y="20" width="60" height="70" rx="7" fill="#d9452b" ${S}/>
    <rect x="20" y="40" width="60" height="30" fill="#fff3e0" ${S3}/>
    ${label(50, 61, 15, '#d9452b', 'Soup')}
    <ellipse cx="50" cy="20" rx="30" ry="7" fill="#d7d7d7" ${S4}/>`,
  detergent: `
    <rect x="52" y="16" width="24" height="20" rx="4" fill="#2f7fc1" ${S4}/>
    <path d="M14 62 Q14 46 30 46 L52 46 L52 34 L76 34 L76 46 Q88 48 88 64 L88 178 Q88 190 76 190 L26 190 Q14 190 14 178 Z" fill="#f08a3c" ${S}/>
    <rect x="24" y="58" width="20" height="40" rx="10" fill="#fbf6ea" ${S4}/>
    <rect x="22" y="112" width="58" height="58" rx="9" fill="#fff3e0" ${S4}/>
    ${label(51, 148, 17, '#2f7fc1', 'Suds')}
    <circle cx="36" cy="126" r="4" fill="#7fb6db"/><circle cx="66" cy="124" r="5" fill="#7fb6db"/>`,
  milk: `
    <rect x="32" y="18" width="36" height="12" fill="#ffffff" ${S4}/>
    <path d="M18 58 L32 30 L68 30 L82 58 Z" fill="#e9f2fb" ${S}/>
    <rect x="18" y="58" width="64" height="130" rx="4" fill="#ffffff"/>
    <rect x="18" y="98" width="64" height="48" fill="#4c8dc9"/>
    ${label(50, 130, 19, '#ffffff', 'Milk')}
    <ellipse cx="36" cy="168" rx="9" ry="5" fill="${INK}"/><ellipse cx="64" cy="78" rx="8" ry="4" fill="${INK}"/>
    <rect x="18" y="58" width="64" height="130" rx="4" fill="none" ${S}/>`,
  wine: `
    <rect x="40" y="10" width="20" height="54" rx="4" fill="#6b1d36" ${S}/>
    <rect x="40" y="10" width="20" height="20" rx="3" fill="#d9b24a" ${S4}/>
    <path d="M40 62 Q22 74 22 102 L22 178 Q22 190 34 190 L66 190 Q78 190 78 178 L78 102 Q78 74 60 62 Z" fill="#7a1f3d" ${S}/>
    <rect x="30" y="118" width="40" height="46" rx="4" fill="#fbf1dc" ${S3}/>
    ${label(50, 146, 13, '#7a1f3d', 'Vin')}
    <path d="M31 104 L31 172" stroke="#ffffff" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round"/>`,
  cereal: `
    <rect x="14" y="14" width="72" height="174" rx="6" fill="#f7c948" ${S}/>
    <rect x="16" y="30" width="68" height="36" fill="#d9452b"/>
    ${label(50, 57, 23, '#ffffff', "O's")}
    <path d="M26 120 L74 120 Q72 152 50 154 Q28 152 26 120 Z" fill="#4c8dc9" ${S4}/>
    <circle cx="38" cy="114" r="6" fill="#f08a3c" ${S3}/><circle cx="51" cy="109" r="6" fill="#f08a3c" ${S3}/><circle cx="63" cy="114" r="6" fill="#f08a3c" ${S3}/>
    <rect x="14" y="14" width="72" height="174" rx="6" fill="none" ${S}/>`,
  towels: `
    <rect x="16" y="14" width="68" height="134" rx="12" fill="#ffffff" ${S}/>
    <rect x="16" y="152" width="68" height="134" rx="12" fill="#ffffff" ${S}/>
    <path d="M28 40 l6 6 l6 -6 M58 40 l6 6 l6 -6 M28 220 l6 6 l6 -6 M58 220 l6 6 l6 -6 M28 252 l6 6 l6 -6 M58 252 l6 6 l6 -6" fill="none" stroke="#7fb6db" stroke-width="4" stroke-linecap="round"/>
    <rect x="10" y="112" width="80" height="76" rx="9" fill="#7fb6db" ${S4}/>
    ${label(50, 157, 17, '#ffffff', 'Soft')}`,
  baguette: `
    <path d="M18 66 Q12 36 58 30 L252 22 Q290 22 286 50 Q284 74 240 78 L54 86 Q20 88 18 66 Z" fill="#e2a85a" ${S}/>
    <path d="M70 40 Q82 56 92 70 M118 36 Q130 52 140 66 M166 34 Q178 50 188 64" fill="none" stroke="#b97a32" stroke-width="7" stroke-linecap="round"/>
    <path d="M206 24 L262 20 Q292 30 286 54 L268 80 L210 82 Z" fill="#f3e7cf" ${S4}/>
    <path d="M222 36 L270 34 M222 50 L276 50 M222 64 L270 66" stroke="#c9b48c" stroke-width="4" stroke-linecap="round"/>`,
  eggs: `
    <path d="M16 58 L26 20 L174 20 L184 58" fill="#cfc0a3" ${S4}/>
    <ellipse cx="42" cy="48" rx="22" ry="26" fill="#fdf3e1" ${S}/>
    <ellipse cx="100" cy="46" rx="22" ry="26" fill="#fdf3e1" ${S}/>
    <ellipse cx="158" cy="48" rx="22" ry="26" fill="#fdf3e1" ${S}/>
    <path d="M8 58 L192 58 L182 92 L18 92 Z" fill="#d8cbb3" ${S}/>
    <path d="M71 58 L71 92 M129 58 L129 92" ${S3}/>`,
  bread: `
    <path d="M20 84 L20 54 Q20 18 62 18 L148 18 Q186 18 184 54 L184 84 Q184 90 176 90 L28 90 Q20 90 20 84 Z" fill="#d99a52" ${S}/>
    <path d="M42 42 Q100 22 162 42" fill="none" stroke="#f3c98c" stroke-width="9" stroke-linecap="round"/>
    <path d="M70 54 L70 82 M100 52 L100 82 M130 54 L130 82" stroke="#b9783a" stroke-width="4" stroke-linecap="round"/>
    <rect x="170" y="40" width="22" height="18" rx="3" fill="#4c8dc9" ${S3}/>`,
  chips: `
    <path d="M18 22 L82 22 L88 88 L12 88 Z" fill="#f7c948" ${S}/>
    <path d="M16 22 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9 l7 -9 l7 9" fill="#f7c948" ${S4}/>
    <rect x="17" y="40" width="67" height="27" fill="#d9452b"/>
    ${label(50, 59, 14, '#ffffff', 'Chips')}
    <path d="M38 74 l10 -4 l8 6 l-6 6 l-10 -2 Z" fill="#f3c98c" ${S3}/>`,
  tomatoes: `
    <circle cx="36" cy="60" r="27" fill="#e2473a" ${S}/>
    <circle cx="67" cy="62" r="25" fill="#d63a2f" ${S}/>
    <path d="M36 34 l-9 -8 M36 34 l9 -8 M36 34 l0 -11 M67 38 l-8 -8 M67 38 l8 -8 M67 38 l0 -10" stroke="#3e8e5a" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="26" cy="52" rx="6" ry="4" fill="#ffffff" opacity="0.6"/>`,
  pie: `
    <path d="M12 62 L188 62 L172 92 L28 92 Z" fill="#c9cfd6" ${S}/>
    <path d="M18 64 Q100 2 182 64 Z" fill="#e2a85a" ${S}/>
    <path d="M58 50 L86 24 M98 58 L126 22 M140 58 L158 40 M46 40 L76 62 M84 26 L124 62 M122 26 L150 50" stroke="#b97a32" stroke-width="6" stroke-linecap="round"/>
    <path d="M18 64 Q100 2 182 64" fill="none" ${S}/>`,
  chicken: `
    ${steam(70, 22)}${steam(100, 18)}
    <rect x="12" y="64" width="176" height="28" rx="7" fill="#c9cfd6" ${S}/>
    <path d="M150 50 L178 30" stroke="${INK}" stroke-width="20" stroke-linecap="round"/>
    <path d="M150 50 L178 30" stroke="#c97a3a" stroke-width="11" stroke-linecap="round"/>
    <circle cx="182" cy="27" r="8" fill="#fff3e0" ${S3}/>
    <ellipse cx="94" cy="58" rx="64" ry="34" fill="#c97a3a" ${S}/>
    <path d="M56 44 Q78 30 106 32" fill="none" stroke="#e8a466" stroke-width="8" stroke-linecap="round"/>`,
  coffee: `
    ${steam(44, 22)}${steam(58, 22)}
    <path d="M26 34 L74 34 L68 92 L32 92 Z" fill="#ffffff" ${S}/>
    <rect x="21" y="24" width="58" height="13" rx="4" fill="#5b4636" ${S4}/>
    <path d="M28 52 L72 52 L70 74 L30 74 Z" fill="#b5703c" ${S4}/>`,
  icecream: `
    <path d="M18 40 L82 40 L76 90 L24 90 Z" fill="#f6c1d0" ${S}/>
    <rect x="13" y="27" width="74" height="15" rx="5" fill="#ffffff" ${S4}/>
    <rect x="28" y="52" width="44" height="26" rx="5" fill="#ffffff" ${S3}/>
    ${label(50, 71, 15, '#4c8dc9', 'Ice')}`,
  cheese: `
    <path d="M12 72 L88 40 L88 86 L12 86 Z" fill="#f7d25c" ${S}/>
    <path d="M12 72 L88 40 L74 30 Z" fill="#fbe38f" ${S4}/>
    <circle cx="40" cy="76" r="6" fill="#e2b43a"/><circle cx="64" cy="64" r="5" fill="#e2b43a"/><circle cx="74" cy="78" r="5" fill="#e2b43a"/>`,
  peas: `
    <path d="M16 22 L84 22 L88 88 L12 88 Z" fill="#5fae5a" ${S}/>
    <rect x="13" y="14" width="74" height="13" rx="3" fill="#cfe8f7" ${S4}/>
    <circle cx="38" cy="52" r="10" fill="#9fd36b" ${S3}/><circle cx="60" cy="50" r="10" fill="#9fd36b" ${S3}/><circle cx="49" cy="70" r="10" fill="#9fd36b" ${S3}/>
    <path d="M74 66 l0 14 M67 73 l14 0 M69 68 l10 10 M79 68 l-10 10" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`,
  fish: `
    <path d="M8 76 L192 68 L188 94 L14 96 Z" fill="#f3e7cf" ${S4}/>
    <path d="M28 54 Q70 18 128 42 L162 22 L156 54 L164 86 L128 66 Q70 90 28 54 Z" fill="#8fb0c9" ${S}/>
    <circle cx="50" cy="50" r="5" fill="${INK}"/>
    <path d="M70 38 Q62 52 70 66" fill="none" ${S4}/>
    <path d="M86 50 q6 -6 12 0 M102 54 q6 -6 12 0" fill="none" stroke="#5f86a5" stroke-width="4" stroke-linecap="round"/>`,
  apples: `
    <path d="M50 30 C30 16 10 34 15 60 C20 84 38 94 50 88 C62 94 80 84 85 60 C90 34 70 16 50 30 Z" fill="#e2473a" ${S}/>
    <path d="M50 30 L54 13" ${S}/>
    <path d="M55 20 Q70 7 78 20 Q65 29 55 20 Z" fill="#3e8e5a" ${S3}/>
    <path d="M28 48 Q30 38 40 36" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.7"/>`,
};

/** Full SVG markup for an item, rotated 90 degrees clockwise when `rot` is set. */
export const itemSvg = (id: ItemId, rot = false): string => {
  const { w, h } = ITEMS[id];
  const W = w * 100;
  const H = h * 100;
  const viewBox = rot ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`;
  const body = rot
    ? `<g transform="translate(${H} 0) rotate(90)">${ART[id]}</g>`
    : ART[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" font-family="Fredoka, sans-serif" aria-hidden="true">${body}</svg>`;
};

/** Small rule/tag icons (24x24, currentColor). */
