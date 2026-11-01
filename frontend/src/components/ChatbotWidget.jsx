import { Bot, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { aiApi, errorMessage } from '../services/api'
import { Spinner } from './ui'

const SUGGESTIONS = ['Show my complaints', 'How long do fixes take?', 'How do I report an issue?']

/** Floating help assistant (rules-based, or Claude when the server has an API key). */
export default function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Hi! Ask me about your complaints — or send a tracking ID like CMP-2026-0001.' }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  async function send(question) {
    const q = question.trim()
    if (!q || busy) return
    setMessages((m) => [...m, { from: 'me', text: q }])
    setText('')
    setBusy(true)
    try {
      const res = await aiApi.chat(q)
      setMessages((m) => [...m, { from: 'bot', text: res.data.reply, links: res.data.links }])
    } catch (err) {
      setMessages((m) => [...m, { from: 'bot', text: errorMessage(err) }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 print:hidden">
      {open && (
        <div className="animate-fade-in mb-3 flex h-[28rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
          <div className="flex items-center gap-2 bg-navy-900 px-4 py-3 text-white">
            <Bot className="size-5" aria-hidden="true" />
            <p className="flex-1 text-sm font-semibold">Campus assistant</p>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded p-1 hover:bg-white/10">
              <X className="size-4" />
            </button>
          </div>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-3" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === 'me' ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-white text-ink shadow-card'}`}>
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.links?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.links.map((l) => (
                        <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="chip bg-brand-50 text-brand-700 hover:bg-brand-100">
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <Spinner className="size-4" />}
          </div>
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1 border-t border-line px-3 py-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip bg-slate-100 text-ink-soft hover:bg-brand-50 hover:text-brand-700" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2 border-t border-line p-2"
            onSubmit={(e) => {
              e.preventDefault()
              send(text)
            }}
          >
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask something…" maxLength={1000} aria-label="Message" />
            <button className="btn-primary px-3" disabled={busy || !text.trim()} aria-label="Send">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="ml-auto grid size-14 place-items-center rounded-full bg-brand-600 text-white shadow-pop transition hover:scale-105 hover:bg-brand-700"
        aria-label={open ? 'Close assistant' : 'Open campus assistant'}
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>
    </div>
  )
}
