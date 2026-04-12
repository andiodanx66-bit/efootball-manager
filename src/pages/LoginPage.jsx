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
    <div className="min-h-screen flex items-center justify-center pitch-bg px-4">
      <div className="w-full max-w-md animate-slide-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-brand-600 items-center justify-center mb-4 shadow-xl shadow-brand-600/30">
            <Trophy size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-wider">eFOOTBALL</h1>
          <p className="text-white/40 text-sm font-mono mt-1">MANAGER SYSTEM</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-display font-semibold mb-6">Masuk ke Akun</h2>

          {error && (
            <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm px-4 py-3 rounded-lg mb-5">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="input pl-10" placeholder="email@contoh.com"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
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

          <p className="text-center text-sm text-white/40 mt-6">
            Belum punya akun?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 transition-colors">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
