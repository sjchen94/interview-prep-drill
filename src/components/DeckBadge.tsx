interface DeckBadgeProps {
  deck: string;
}

export default function DeckBadge({ deck }: DeckBadgeProps) {
  const label = deck === "blind75" ? "Blind 75" : "Sys Design";
  const color =
    deck === "blind75"
      ? "bg-purple-900/60 text-purple-300 border-purple-700"
      : "bg-cyan-900/60 text-cyan-300 border-cyan-700";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}
    >
      {label}
    </span>
  );
}
