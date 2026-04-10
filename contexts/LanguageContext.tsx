'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { en, type TranslationKey } from '@/lib/i18n/en'
import { ms } from '@/lib/i18n/ms'

export type Language = 'en' | 'ms'

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, ms }

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: TranslationKey) => en[key] ?? key,
})

const STORAGE_KEY = 'utopia-lang'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (stored === 'en' || stored === 'ms') setLanguageState(stored)
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {}
  }, [])

  const t = useCallback((key: TranslationKey) => {
    const dict = DICTIONARIES[language]
    return dict[key] ?? en[key] ?? key
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export function useTranslation() {
  const { t } = useContext(LanguageContext)
  return { t }
}
