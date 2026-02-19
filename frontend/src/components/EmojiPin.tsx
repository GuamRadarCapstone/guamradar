export function EmojiPin({
  emoji,
  border,
  bg,
}: {
  emoji: string;
  border: string;
  bg: string;
}) {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${border}`,
        background: bg,
        boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
        fontSize: 16,
        cursor: "pointer",
      }}
    >
      {emoji}
    </div>
  );
}
