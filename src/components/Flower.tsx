export function Flower({ size = 32, className = '' }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
    {[0, 60, 120, 180, 240, 300].map(angle => <ellipse key={angle} cx="32" cy="21" rx="7.6" ry="15" transform={`rotate(${angle} 32 32)`} fill="currentColor" />)}
    <circle cx="32" cy="32" r="7.5" fill="var(--surface-solid, #fff)" />
  </svg>;
}
