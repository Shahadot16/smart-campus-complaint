import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { Field, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, fieldErrors } from '../../services/api'

const EMPTY = { name: '', email: '', studentId: '', department: '', phone: '', password: '', confirm: '' }

function validate(f) {
  const e = {}
  if (f.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Please enter a valid email address'
  if (!/^[A-Za-z0-9-]{3,30}$/.test(f.studentId.trim())) e.studentId = 'Letters, numbers and dashes (3–30 characters)'
  if (f.phone && !/^[+\d\s-]{6,20}$/.test(f.phone.trim())) e.phone = 'Please enter a valid phone number'
  if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password))
    e.password = 'At least 8 characters with a letter and a number'
  if (f.confirm !== f.password) e.confirm = 'Passwords do not match'
  return e
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      const { confirm: _confirm, ...body } = form
      await register({
        ...body,
        name: body.name.trim(),
        email: body.email.trim(),
        studentId: body.studentId.trim(),
        department: body.department.trim(),
        phone: body.phone.trim(),
      })
      toast.success('Account created. Welcome!')
      navigate('/student', { replace: true })
    } catch (err) {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err, 'Registration failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const input = (k, props = {}) => (
    <input id={k} className={`input ${errors[k] ? 'input-error' : ''}`} value={form[k]} onChange={set(k)} {...props} />
  )

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-navy-900">Create student account</h1>
      <p className="mt-1 text-sm text-ink-soft">Register to submit and track campus complaints.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" error={errors.name} required>
          {input('name', { autoComplete: 'name' })}
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email} required>
          {input('email', { type: 'email', autoComplete: 'email', placeholder: 'you@campus.edu' })}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Student ID" htmlFor="studentId" error={errors.studentId} required>
            {input('studentId', { placeholder: 'e.g. 2021-CSE-042' })}
          </Field>
          <Field label="Department" htmlFor="department" error={errors.department}>
            {input('department', { placeholder: 'e.g. CSE' })}
          </Field>
        </div>
        <Field label="Phone" htmlFor="phone" error={errors.phone}>
          {input('phone', { type: 'tel', autoComplete: 'tel' })}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" error={errors.password} required>
            {input('password', { type: 'password', autoComplete: 'new-password' })}
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={errors.confirm} required>
            {input('confirm', { type: 'password', autoComplete: 'new-password' })}
          </Field>
        </div>
        <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
          {submitting ? <Spinner className="size-4 text-white" /> : <UserPlus className="size-4" />}
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
