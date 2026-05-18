import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, Mail, Lock, User, AlertCircle, CheckCircle, Shield, Key, Phone } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function RegisterPage() {
  const [form,    setForm]    = useState({ email: '', password: '', username: '', teamName: '', token: '', whatsapp: '' })
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate   = useNavigate()

  function update(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signUp(form.email, form.password, form.username, form.teamName, form.token, form.whatsapp)
    if (error) setError(error.message)
    else setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] pitch-bg px-4">
      <div className="card p-8 max-w-md w-full text-center animate-slide-in">
        <div className="w-14 h-14 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-accent-green" />
        </div>
        <h2 className="text-xl font-display font-bold mb-2 text-ink">Registrasi Berhasil!</h2>
        <p className="text-ink-muted text-sm mb-6">Cek email kamu untuk konfirmasi akun, lalu login.</p>
        <Link to="/login" className="btn-primary inline-block">Ke Halaman Login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] pitch-bg px-4 py-8">
      <div className="w-full max-w-md animate-slide-in">

        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-600 items-center justify-center mb-4 shadow-lg shadow-brand-600/25">
            <Trophy size={26} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-ink">eFOOTBALL</h1>
          <p className="text-ink-faint text-sm font-mono mt-1 uppercase tracking-widest">Manager System</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-display font-semibold mb-6 text-ink">Buat Akun Baru</h2>

          {error && (
            <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm px-4 py-3 rounded-lg mb-5">
              <AlertCircle size={15} className="shrink-0" />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Token Undangan',  key: 'token',    Icon: Key,    type: 'text',     placeholder: 'Token dari admin' },
              { label: 'Nama Tim',        key: 'teamName', Icon: Shield, type: 'text',     placeholder: 'Nama tim eFootball kamu' },
              { label: 'Username',        key: 'username', Icon: User,   type: 'text',     placeholder: 'username' },
              { label: 'No. WhatsApp',    key: 'whatsapp', Icon: Phone,  type: 'tel',      placeholder: '628xxxxxxxxxx' },
              { label: 'Email',           key: 'email',    Icon: Mail,   type: 'email',    placeholder: 'email@contoh.com' },
              { label: 'Password',        key: 'password', Icon: Lock,   type: 'password', placeholder: 'Min. 6 karakter' },
            ].map(({ label, key, Icon, type, placeholder }) => (
              <div key={key}>
                <label className="text-sm text-ink-muted mb-1.5 block font-medium">{label}</label>
                <div className="relative">
                  <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    type={type}
                    required={key !== 'whatsapp'}
                    minLength={key === 'password' ? 6 : undefined}
                    value={form[key]}
                    onChange={update(key)}
                    className="input pl-10"
                    placeholder={placeholder}
                  />
                </div>
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
            </button>
          </form>

          <p className="text-center text-sm text-ink-faint mt-6">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
