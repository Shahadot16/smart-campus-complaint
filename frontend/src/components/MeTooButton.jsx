import { ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import api, { errorMessage } from '../services/api'

/** "Me too" vote for a public complaint (students other than the reporter). */
export default function MeTooButton({ complaint, onChange }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [state, setState] = useState({ voted: complaint.voted, votes: complaint.votes || 0 })
  const [busy, setBusy] = useState(false)
  const canVote = user.role === 'student' && !complaint.mine

  async function toggle() {
    setBusy(true)
    try {
      const res = state.voted ? await api.delete(`/complaints/${complaint._id}/vote`) : await api.post(`/complaints/${complaint._id}/vote`)
      setState({ voted: !state.voted, votes: res.data.data.votes })
      if (!state.voted) toast.success(res.data.message)
      onChange?.()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!canVote || busy}
      aria-pressed={state.voted}
      title={complaint.mine ? 'You reported this' : ''}
      className={`btn btn-sm rounded-full ring-1 ring-inset ${state.voted ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-soft ring-line hover:ring-brand-200'}`}
    >
      <ThumbsUp className="size-3.5" aria-hidden="true" /> {t('Me too')} · {state.votes}
    </button>
  )
}
