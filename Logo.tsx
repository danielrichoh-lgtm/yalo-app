export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`relative inline-block font-display font-bold leading-none ${className}`} style={{ color: '#111111' }}>
      Yalo
      <span
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          width: 7,
          height: 7,
          background: '#2ECC71',
          top: -2,
          right: -5,
        }}
      />
    </span>
  )
}
