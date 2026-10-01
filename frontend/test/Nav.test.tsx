import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Nav from '../src/Nav';

const LINKS: { label: string; href: string }[] = [
  { label: 'Training', href: '/training' },
  { label: 'Pläne', href: '/plans' },
  { label: 'Methoden', href: '/training-methods' },
  { label: 'Übungen', href: '/exercises' },
  { label: 'Historie', href: '/history' },
];

describe('Nav', () => {
  it('renders all five nav links with the correct hrefs', () => {
    render(
      <MemoryRouter initialEntries={['/training']}>
        <Nav />
      </MemoryRouter>,
    );

    for (const { label, href } of LINKS) {
      const links = screen.getAllByRole('link', { name: label });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toHaveAttribute('href', href);
      }
    }
  });

  it('marks the link matching the current route as active', () => {
    render(
      <MemoryRouter initialEntries={['/plans']}>
        <Nav />
      </MemoryRouter>,
    );

    for (const link of screen.getAllByRole('link', { name: 'Pläne' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
    for (const link of screen.getAllByRole('link', { name: 'Training' })) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('switches the active link when the route changes', () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Nav />
      </MemoryRouter>,
    );

    for (const link of screen.getAllByRole('link', { name: 'Historie' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
    for (const link of screen.getAllByRole('link', { name: 'Übungen' })) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });
});

describe('Nav user menu', () => {
  it('shows the username and calls onLogout', async () => {
    const onLogout = vi.fn();
    render(
      <MemoryRouter initialEntries={['/training']}>
        <Nav username="anna" onLogout={onLogout} />
      </MemoryRouter>,
    );

    expect(screen.getByText('anna')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Abmelden' }).click();
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
