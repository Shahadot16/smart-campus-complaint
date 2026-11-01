import { MessagesSquare, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import useApi from '../hooks/useApi'
import { complaintApi, errorMessage } from '../services/api'
import { ROLE_LABELS } from '../utils/constants'
import { formatDateTime } from '../utils/format'
import { PageLoader, Spinner } from './ui'

const timeOnly = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** Live chat between the student, the assigned staff member and admins. */
export default function ChatPanel({ complaintId }) {
  const { user } = useAuth()
  const { socket } = useSocket()
  const { data: messages, loading, setData } = useApi(() => complaintApi.messages(complaintId), [complaintId])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(null)
  const listRef = useRef(null)
  const typingTimer = useRef(null)

  const add = (m) => setData((list) => (list?.some((x) => x._id === m._id) ? list : [...(list || []), m]))

  useSocketEvent('chat:message', (m) => {
    if (String(m.complaint) !== String(complaintId)) return
    add(m)
    setTyping(null)
  })
  useSocketEvent('chat:typing', (t) => {
    if (String(t.complaintId) !== String(complaintId)) return
    setTyping(t.typing ? t.name : null)
  })

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  function onType(value) {
    setText(value)
    if (!socket) return
    socket.emit('chat:typing', { complaintId, typing: true })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => socket.emit('chat:typing', { complaintId, typing: false }), 1500)
  }

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      const res = await complaintApi.sendMessage(complaintId, text.trim())
      add(res.data)
      setText('')
      socket?.emit('chat:typing', { complaintId, typing: false })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-5 py-3 font-semibold text-navy-900">
        <MessagesSquare className="size-4 text-brand-600" aria-hidden="true" /> Chat
      </h2>
      <div ref={listRef} className="h-80 space-y-3 overflow-y-auto bg-slate-50/50 px-4 py-4" aria-live="polite">
        {loading ? (
          <PageLoader label="Loading messages…" />
        ) : !messages?.length ? (
          <p className="pt-24 text-center text-sm text-ink-muted">No messages yet. Ask a question or share an update.</p>
        ) : (
          messages.map((m) => {
            const mine = String(m.sender?._id) === String(user.id)
            return (
              <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-card ${mine ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-white text-ink'}`}>
                  {!mine && (
                    <p className="mb-0.5 text-[11px] font-semibold text-brand-700">
                      {m.sender?.name} · {ROLE_LABELS[m.sender?.role]}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.text}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-brand-100' : 'text-ink-muted'}`} title={formatDateTime(m.createdAt)}>
                    {timeOnly.format(new Date(m.createdAt))}
                  </p>
                </div>
              </div>
            )
          })
        )}
        {typing && <p className="animate-pulse text-xs text-ink-muted italic">{typing} is typing…</p>}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <input className="input" placeholder="Type a message…" value={text} onChange={(e) => onType(e.target.value)} maxLength={2000} aria-label="Message" />
        <button className="btn-primary px-3" disabled={sending || !text.trim()} aria-label="Send">
          {sending ? <Spinner className="size-4 text-white" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  )
}
