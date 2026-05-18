import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    else navigate('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] pitch-bg px-4">
      <div className="w-full max-w-md animate-slide-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-600 items-center justify-center mb-4 shadow-lg shadow-brand-600/25">
            <Trophy size={26} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-ink">eFOOTBALL</h1>
          <p className="text-ink-faint text-sm font-mono mt-1 uppercase tracking-widest">Manager System</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-display font-semibold mb-6 text-ink">Masuk ke Akun</h2>

          {error && (
            <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm px-4 py-3 rounded-lg mb-5">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-ink-muted mb-1.5 block font-medium">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="input pl-10" placeholder="email@contoh.com"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-ink-muted mb-1.5 block font-medium">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="input pl-10" placeholder="••••••••"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="text-center text-sm text-ink-faint mt-6">
            Belum punya akun?{' '}
            <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
