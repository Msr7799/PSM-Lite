'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '../i18n/routing';
import { ChangeEvent, useTransition } from 'react';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    function onSelectChange(event: ChangeEvent<HTMLSelectElement>) {
        const nextLocale = event.target.value;
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    }

    return (
        <select
            defaultValue={locale}
            disabled={isPending}
            onChange={onSelectChange}
            className="rounded bg-white/20 px-2 py-1 text-sm text-white backdrop-blur-sm focus:bg-white/30 focus:outline-none"
        >
            <option value="en" className="text-black">English</option>
            <option value="ar" className="text-black">العربية</option>
        </select>
    );
}
