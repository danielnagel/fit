export default function MadeBy({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs ${className}`}>
      <a href="https://dnagel.de" target="_blank" rel="noopener noreferrer" className="text-fg-muted hover:underline">
        Made by Daniel
      </a>
    </p>
  );
}
