import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import bn from '../locales/bn'

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (s) => s })

/**
 * Tiny i18n: English text is the key, `bn` maps it to Bangla.
 * Anything not yet translated simply shows in English.
 */
export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')

  useEffect(() => {
    localStorage.setItem('lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((text, vars) => {
    let out = (lang === 'bn' && bn[text]) || text
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, v)
    return out
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLang = () => useContext(LanguageContext)

/** EN | বাং switch. */
export function LanguageSwitch({ className = '' }) {
  const { lang, setLang } = useLang()
  return (
    <div className={`inline-flex rounded-lg p-0.5 text-xs font-semibold ring-1 ring-inset ${className}`} role="group" aria-label="Language">
      {[
        ['en', 'EN'],
        ['bn', 'বাং'],
      ].map(([code, label]) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`rounded-md px-2.5 py-1 transition ${lang === code ? 'bg-brand-600 text-white' : 'opacity-70 hover:opacity-100'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
