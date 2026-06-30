// Small top-left corner emblem for the chat card (~96px ring): a hatched double ring
// (gap in the bold ring, hollow centre) that straddles the card's top-left edge, with a
// short connector line a small way into the card near the top. Ambient only (slow hatch
// rotation + glow pulse, in CSS); never a state indicator. Reduced-motion -> static.

const CX = 55;
const CY = 55;

// Diagonal hatch lines filling the ring band; clipped to the annulus (r34..r46).
const HATCH = Array.from({ length: 20 }, (_, i) => {
  const o = -30 + i * 6;
  return { x1: o, y1: 110, x2: o + 110, y2: 0 };
});

export function Emblem() {
  return (
    <svg className="chat-emblem" viewBox="0 0 150 110" aria-hidden="true">
      <defs>
        <clipPath id="emblem-band">
          <path
            clipRule="evenodd"
            d="M9,55 a46,46 0 1,0 92,0 a46,46 0 1,0 -92,0 Z M21,55 a34,34 0 1,0 68,0 a34,34 0 1,0 -68,0 Z"
          />
        </clipPath>
      </defs>
      {/* Rotating inner hatch texture (clipped to the band) */}
      <g className="emblem-spin">
        <g clipPath="url(#emblem-band)">
          {HATCH.map((h, i) => (
            <line key={i} className="emblem-hatch" x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} />
          ))}
        </g>
      </g>
      {/* Static rings + node dots */}
      <circle className="emblem-ring" cx={CX} cy={CY} r="48" />
      <path className="emblem-bold" d="M24.4,67.4 A33,33 0 1,1 34.7,81" />
      <circle className="emblem-node-ring" cx="20" cy="20" r="3" />
      <line className="emblem-conn" x1="24" y1="24" x2="33" y2="33" />
      <circle className="emblem-node" cx="84" cy="80" r="2.5" />
      <circle className="emblem-node" cx="71" cy="92" r="2.5" />
      {/* Short connector line into the card, near the top */}
      <line className="emblem-conn" x1="97" y1="63" x2="132" y2="63" />
      <circle className="emblem-conn-node" cx="132" cy="63" r="3" />
    </svg>
  );
}
