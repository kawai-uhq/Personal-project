export function LogoMark({ size = 32, color }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <rect width="200" height="200" rx="46" fill="#1B1220" />
      <path d="M139.8 66.6A52 52 0 1 0 139.8 133.4" fill="none" stroke={color ?? 'var(--accent)'} strokeWidth="26" strokeLinecap="round" />
      <path d="M92 83L92 117L120 100Z" fill="#FFE9D6" stroke="#FFE9D6" strokeWidth="9" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo" aria-label="Comvie">
      <LogoMark size={size} />
      <span className="logo-word" style={{ fontSize: size * 0.85 }}>
        com<span>vie</span>
      </span>
    </span>
  );
}
