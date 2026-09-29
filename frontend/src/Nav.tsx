import { NavLink } from 'react-router-dom';

type IconName = 'training' | 'plans' | 'methods' | 'exercises' | 'history';

const links: { to: string; label: string; icon: IconName }[] = [
  { to: '/training', label: 'Training', icon: 'training' },
  { to: '/plans', label: 'Pläne', icon: 'plans' },
  { to: '/training-methods', label: 'Methoden', icon: 'methods' },
  { to: '/exercises', label: 'Übungen', icon: 'exercises' },
  { to: '/history', label: 'Historie', icon: 'history' },
];

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const common = { className, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'training':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M6.5 9v6M17.5 9v6M2 10.5v3M22 10.5v3M6.5 12h11" />
        </svg>
      );
    case 'plans':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5M7.5 13h3M7.5 16.5h6" />
        </svg>
      );
    case 'methods':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1" />
          <circle cx="13" cy="6" r="2" fill="currentColor" stroke="none" />
          <circle cx="7" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="17" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'exercises':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 6.5c-1.4-1.2-3.4-1.8-5.5-1.5C4.9 5.2 4 6 4 6v12.5s.9-.8 2.5-1c2.1-.3 4.1.3 5.5 1.5m0-12.5c1.4-1.2 3.4-1.8 5.5-1.5 1.6.3 2.5 1 2.5 1v12.5s-.9-.8-2.5-1c-2.1-.3-4.1.3-5.5 1.5m0-12.5V19" />
        </svg>
      );
    case 'history':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l3 2M4 5l2.2 2M9 3.5l.6 1.9" />
        </svg>
      );
  }
}

export default function Nav() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/training" className="flex shrink-0 items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="text-base font-semibold tracking-tight text-fg sm:text-lg">Fit</span>
          </NavLink>

          <div className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-accent/30 bg-surface-2 text-accent'
                      : 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg'
                  }`
                }
              >
                <NavIcon name={link.icon} className="size-4" />
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/95 backdrop-blur sm:hidden">
        <div className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-fg-muted'
                }`
              }
            >
              <NavIcon name={link.icon} className="size-5" />
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
