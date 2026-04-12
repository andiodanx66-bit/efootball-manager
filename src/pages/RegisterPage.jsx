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
    <div className="min-h-screen flex items-center justify-center pitch-bg px-4">
      <div className="card p-8 max-w-md w-full text-center animate-slide-in">
        <CheckCircle size={48} className="text-accent-green mx-auto mb-4" />
        <h2 className="text-xl font-display font-bold mb-2">Registrasi Berhasil!</h2>
        <p className="text-white/60 text-sm mb-6">Cek email kamu untuk konfirmasi akun, lalu login.</p>
        <Link to="/login" className="btn-primary inline-block">Ke Halaman Login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center pitch-bg px-4 py-8">
      <div className="w-full max-w-md animate-slide-in">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-brand-600 items-center justify-center mb-4 shadow-xl shadow-brand-600/30">
            <Trophy size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-wider">eFOOTBALL</h1>
          <p className="text-white/40 text-sm font-mono mt-1">MANAGER SYSTEM</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-display font-semibold mb-6">Buat Akun Baru</h2>

          {error && (
            <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm px-4 py-3 rounded-lg mb-5">
              <AlertCircle size={15} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Token Undangan</label>
              <div className="relative">
                <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input required value={form.token} onChange={update('token')} className="input pl-10" placeholder="Token dari admin" />
              </div>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Nama Tim</label>
              <div className="relative">
                <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input required value={form.teamName} onChange={update('teamName')} className="input pl-10" placeholder="Nama tim eFootball kamu" />
              </div>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input required value={form.username} onChange={update('username')} className="input pl-10" placeholder="username" />
              </div>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">No. WhatsApp</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="tel" value={form.whatsapp} onChange={update('whatsapp')} className="input pl-10" placeholder="628xxxxxxxxxx" />
              </div>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="email" required value={form.email} onChange={update('email')} className="input pl-10" placeholder="email@contoh.com" />
              </div>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="password" required minLength={6} value={form.password} onChange={update('password')} className="input pl-10" placeholder="Min. 6 karakter" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
            </button>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
