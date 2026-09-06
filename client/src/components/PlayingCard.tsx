import type { Card, Suit } from "@games/simple-card-game";
import "./PlayingCard.css";

type PlayingCardProps = (
  | { variant: "face"; card: Card }
  | { variant: "back" | "empty"; card?: never }
) & { size?: "small" | "large"; winner?: boolean; label?: string };

const suitPaths: Record<Suit, string> = {
  hearts: "M0 22C-5 15-25 2-25-12C-25-30-7-32 0-17C7-32 25-30 25-12C25 2 5 15 0 22Z",
  spades: "M0-29C-6-20-25-8-25 5C-25 20-8 23-3 12L-7 28H7L3 12C8 23 25 20 25 5C25-8 6-20 0-29Z",
  diamonds: "M0-30 22 0 0 30-22 0Z",
  clubs: "M-4 11C-20 26-34 5-20-6C-15-10-10-8-7-6C-22-29 22-29 7-6C10-8 15-10 20-6C34 5 20 26 4 11L8 28H-8Z",
};

function SuitMark({ suit, x, y, scale = 1, inverted = false }: {
  suit: Suit; x: number; y: number; scale?: number; inverted?: boolean;
}) {
  return <path d={suitPaths[suit]} transform={`translate(${x} ${y}) scale(${scale}) rotate(${inverted ? 180 : 0})`} fill="currentColor" />;
}

// Presentation coordinates only. Rank values and game rules remain in /games.
const pipLayouts: Record<string, [number, number][]> = {
  "2": [[100, 76], [100, 204]],
  "3": [[100, 76], [100, 140], [100, 204]],
  "4": [[65, 76], [135, 76], [65, 204], [135, 204]],
  "5": [[65, 76], [135, 76], [100, 140], [65, 204], [135, 204]],
  "6": [[65, 76], [135, 76], [65, 140], [135, 140], [65, 204], [135, 204]],
  "7": [[65, 76], [135, 76], [100, 108], [65, 140], [135, 140], [65, 204], [135, 204]],
  "8": [[65, 76], [135, 76], [100, 108], [65, 140], [135, 140], [100, 172], [65, 204], [135, 204]],
  "9": [[65, 70], [135, 70], [65, 116], [135, 116], [100, 140], [65, 164], [135, 164], [65, 210], [135, 210]],
  "10": [[65, 70], [135, 70], [100, 94], [65, 116], [135, 116], [65, 164], [135, 164], [100, 186], [65, 210], [135, 210]],
};

function Court({ card }: { card: Card }) {
  return <g>
    <rect x="43" y="49" width="114" height="182" rx="3" fill="#f2e9d8" stroke="#b39353" />
    {[false, true].map(flipped => <g key={String(flipped)} transform={flipped ? "rotate(180 100 140)" : undefined}>
      <path d="M49 132 68 103H132L151 132V140H49Z" fill="currentColor" />
      <path d="M71 107 100 131 129 107M62 118 85 140M138 118 115 140" fill="none" stroke="#cbaa68" strokeWidth="4" />
      <path d="M83 77Q100 65 117 77L114 101 100 115 86 101Z" fill="#fdf6e7" stroke="#b39353" strokeWidth="1.5" />
      <path d="M87 86H93M107 86H113M101 86 98 96H103M96 102H105" fill="none" stroke="#233c48" strokeWidth="2" />
      {card.rank === "J" ? <path d="M79 78 84 63 112 61 123 78ZM115 66Q139 41 134 78" fill="#233c48" stroke="#cbaa68" strokeWidth="2" /> :
        <path d={card.rank === "Q" ? "M81 78 78 61 90 68 100 55 110 68 122 61 119 78Z" : "M80 78 77 58 90 65 100 50 110 65 123 58 120 78Z"} fill="#cbaa68" stroke="#8b703b" />}
      {card.rank === "K" && <path d="M87 98 100 106 113 98 109 112 100 119 91 112Z" fill="#233c48" />}
      {card.rank === "Q" && <g fill="#cbaa68"><circle cx="81" cy="92" r="3" /><circle cx="119" cy="92" r="3" /></g>}
      <SuitMark suit={card.suit} x={57} y={66} scale={0.22} />
    </g>)}
    <path d="M48 140H152" stroke="#cbaa68" strokeWidth="3" />
    <path d="M100 126 113 140 100 154 87 140Z" fill="#cbaa68" stroke="#fff8e9" />
  </g>;
}

function CardBack() {
  return <g>
    <rect x="8" y="8" width="184" height="264" rx="9" fill="#183947" />
    <rect x="16" y="16" width="168" height="248" rx="5" fill="none" stroke="#c8a768" />
    <rect x="21" y="21" width="158" height="238" rx="3" fill="none" stroke="#c8a768" strokeOpacity=".45" />
    {Array.from({ length: 9 }, (_, i) => <path key={i}
      d={`M100 ${29 + i * 12}L174 140 100 ${251 - i * 12} 26 140Z`}
      fill="none" stroke="#c8a768" strokeWidth=".7" strokeOpacity=".45" />)}
    {[44, 236].map(y => <g key={y} transform={`translate(100 ${y})`}>
      <path d="M0-10 3-3 10 0 3 3 0 10-3 3-10 0-3-3Z" fill="#d6b97d" />
      <path d="M-51 0H-19M19 0H51" stroke="#d6b97d" strokeWidth=".7" />
    </g>)}
    <circle cx="100" cy="140" r="37" fill="#183947" stroke="#c8a768" strokeWidth="1.5" />
    <circle cx="100" cy="140" r="31" fill="none" stroke="#c8a768" strokeWidth=".6" />
    <g color="#dec48c"><SuitMark suit="spades" x={100} y={137} scale={0.65} /></g>
    <path d="M87 164H113" stroke="#c8a768" />
  </g>;
}

export function PlayingCard(props: PlayingCardProps) {
  const { variant, size = "small", winner = false } = props;
  const card = variant === "face" ? props.card : null;
  const label = props.label ?? (card ? `${card.rank} of ${card.suit}${winner ? ", winning card" : ""}` :
    variant === "back" ? "Face-down card" : "No card drawn yet");
  return <div className={`playing-card playing-card--${variant} playing-card--${size}${winner ? " playing-card--winner" : ""}`}
    role="img" aria-label={label} data-card-state={variant}>
    {variant === "empty" ? <div className="card-placeholder" aria-hidden="true"><span>＋</span><span>AWAITING CARD</span></div> :
      <svg viewBox="0 0 200 280" aria-hidden="true" focusable="false" className={card && ["hearts", "diamonds"].includes(card.suit) ? "suit-red" : "suit-black"}>
        <rect x="1" y="1" width="198" height="278" rx="13" fill="#fffcf4" stroke="#dacfb9" strokeWidth="1.2" />
        {variant === "back" ? <CardBack /> : card && <>
          <rect x="7" y="7" width="186" height="266" rx="9" fill="none" stroke="#ede3d1" strokeWidth=".6" />
          {[false, true].map(inverted => <g key={String(inverted)} transform={inverted ? "rotate(180 100 140)" : undefined}>
            <text x="24" y="35" textAnchor="middle" fontSize={card.rank === "10" ? "25" : "29"} fontWeight="600" fontFamily="Georgia, serif" fill="currentColor">{card.rank}</text>
            <SuitMark suit={card.suit} x={24} y={52} scale={0.29} />
          </g>)}
          {card.rank === "A" ? <g>
            <circle cx="100" cy="138" r="48" fill="none" stroke="#c5a366" strokeWidth=".8" />
            <circle cx="100" cy="138" r="43" fill="none" stroke="#c5a366" strokeDasharray="1 5" strokeWidth="1.5" />
            <SuitMark suit={card.suit} x={100} y={136} scale={1.05} />
            <text x="100" y="206" textAnchor="middle" fontSize="8" letterSpacing="3" fill="#927342">CARD GENIE</text>
          </g> : pipLayouts[card.rank] ? pipLayouts[card.rank].map(([x, y], i) =>
            <SuitMark key={i} suit={card.suit} x={x} y={y} scale={0.49} inverted={y > 140} />) : <Court card={card} />}
        </>}
      </svg>}
    {winner && <span className="card-winner-label" aria-hidden="true">WINNING CARD</span>}
  </div>;
}
