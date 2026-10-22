import { useMemo } from "react";

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function Highlight({ text, terms }) {
  const regex = useMemo(() => {
    const cleaned = (terms ?? []).filter(Boolean).map(escape);
    if (cleaned.length === 0) return null;
    cleaned.sort((a, b) => b.length - a.length);
    return new RegExp(`(?<![A-Za-z0-9])(${cleaned.join("|")})(?![A-Za-z0-9])`, "gi");
  }, [terms]);

  if (!text) return null;
  if (!regex) return <>{text}</>;

  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="hl">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}
