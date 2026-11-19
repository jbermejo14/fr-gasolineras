'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { SITE_NAME, SECTION_NAME } from '@/lib/site';
import { formatDateTimeParis } from '@/lib/format';
import { Sun, Moon } from 'lucide-react';

// Debe coincidir con el separador que produce formatDateTimeParis (lo comprueba tests/texts.test.ts).
const DATE_TIME_SEPARATOR = ' à ';
const THEME_STORAGE_KEY = 'ododex-theme';

interface HeaderProps {
  /** Fecha ISO de la última actualización de los precios. */
  updatedAt?: string;
}

type HeaderTheme = 'dark' | 'light';

/** Abrevia "19/11/2026 à 11:09" a la hora "11:09" para pantallas estrechas. */
function headerShortDate(dateTime: string): string {
  return dateTime.split(DATE_TIME_SEPARATOR)[1] ?? dateTime;
}

/** Aplica el tema a <html>: atributo para el CSS propio y clase para Tailwind. */
function headerApplyTheme(theme: HeaderTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
}

/** Tema que ya fijó el script de layout.tsx antes de pintar. */
function headerReadTheme(): HeaderTheme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function HeaderUpdatedBadge({ updatedAt }: { updatedAt: string }) {
  const dateTime = formatDateTimeParis(updatedAt);
  return (
    <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] px-2.5 sm:px-3 h-10 rounded-full text-xs text-[var(--text-main)] shadow-sm">
      <span className="w-2 h-2 rounded-full bg-[var(--orange-primary)] animate-pulse-glow" />
      <span className="hidden md:inline text-[var(--text-muted)]">Mis à jour le :</span>
      <strong className="font-mono text-[var(--orange-primary)]">
        <span className="sm:hidden">{headerShortDate(dateTime)}</span>
        <span className="hidden sm:inline">{dateTime}</span>
      </strong>
    </div>
  );
}

export function Header({ updatedAt }: HeaderProps) {
  const [theme, setTheme] = useState<HeaderTheme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(headerReadTheme());
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: HeaderTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    headerApplyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sin localStorage (modo privado, cookies bloqueadas) el tema solo dura la visita.
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-header)] border-b border-[var(--border-color)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-2 md:py-3 flex items-center justify-between gap-2 sm:gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3 group min-w-0"
          aria-label={`${SITE_NAME} · ${SECTION_NAME}, accueil`}
        >
          <BrandLogo />
          <span aria-hidden="true" className="w-px h-7 sm:h-8 bg-[var(--border-color)] shrink-0" />
          <div className="min-w-0">
            <span className="block sm:hidden text-[11px] leading-tight font-extrabold uppercase text-[var(--text-main)]">
              Prix des
              <span className="block text-[var(--orange-primary)]">carburants</span>
            </span>
            <span className="hidden sm:block truncate text-base font-extrabold uppercase text-[var(--text-main)] group-hover:text-[var(--orange-primary)] transition-colors">
              Prix des <span className="text-[var(--orange-primary)]">carburants</span>
            </span>
            <p className="text-xs text-[var(--text-muted)] hidden lg:block">
              Données officielles de prix-carburants.gouv.fr
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {updatedAt && <HeaderUpdatedBadge updatedAt={updatedAt} />}

          {mounted && (
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center gap-1.5 min-w-10 h-10 px-2.5 sm:px-3 rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-main)] hover:border-[var(--orange-primary)] transition-colors cursor-pointer select-none"
              title="Passer du mode clair au mode sombre"
              aria-label="Changer de thème"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-[var(--orange-primary)]" />
                  <span className="hidden sm:inline">Mode clair</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[var(--orange-primary)]" />
                  <span className="hidden sm:inline">Mode sombre</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
