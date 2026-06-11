'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { ChangeEvent, useTransition } from 'react';
import { defaultLocale, locales, localeLabels, type Locale } from './config';

export function LocaleSwitcher() {
  const router = useRouter();
  // next-intl's usePathname strips the locale prefix automatically.
  const pathname = usePathname();
  const currentLocale = useLocale();
  const [isPending, startTransition] = useTransition();

  function onSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    const basePath = pathname || '/';
    const target = nextLocale === defaultLocale ? basePath : `/${nextLocale}${basePath === '/' ? '' : basePath}`;

    startTransition(() => {
      router.replace(target);
    });
  }

  return (
    <select
      value={currentLocale}
      onChange={onSelectChange}
      disabled={isPending}
      aria-label="Select language"
      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeLabels[locale]}
        </option>
      ))}
    </select>
  );
}

export default LocaleSwitcher;
