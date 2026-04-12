import { useEffect, useState } from 'react'
import { Plus, Shield, User, Send, Edit2, AlertCircle, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const statusBadge = { pending: 'badge-yellow', rejected: 'badge-red' }
const statusLabel = { pending: 'Menunggu persetujuan', rejected: 'Ditolak' }

export default function MyTeamPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [team,    setTeam]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)

  useEffect(() => { fetchMyTeam() }, [user?.id])

  async function fetchMyTeam() {
    if (!user?.id) return
    setLoading(true)

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (teamError) {
      console.error(teamError)
    } else {
      setTeam(teamData)
    }

    setLoading(false)
  }

  async function resubmitTeam() {
    if (!team || team.status !== 'rejected') return
    if (!window.confirm('Kirim ulang ke admin untuk persetujuan?')) return

    const { error } = await supabase
      .from('teams')
      .update({ status: 'pending' })
      .eq('id', team.id)

    if (error) alert(error.message)
    else fetchMyTeam()
  }

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  if (!team) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-white/20">
        <Shield size={40} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-display font-bold">Belum Ada Tim</h2>
        <p className="text-white/40 text-sm mt-1 max-w-md">
          Satu akun satu tim (nama tim untuk kompetisi eFootball di HP). Setelah dibuat, tim langsung masuk antrian persetujuan admin.
        </p>
      </div>
      <button onClick={() => setModal('team')} className="btn-primary flex items-center gap-2 mt-4">
        <Plus size={18} /> Buat & daftar tim
      </button>
      {modal === 'team' && <CreateTeamModal onClose={() => setModal(null)} onCreated={() => { setModal(null); fetchMyTeam() }} />}
    </div>
  )

  const canEdit = team.status === 'approved' || team.status === 'rejected'
  const needsResubmit = team.status === 'rejected'
  const avatar = profile?.avatar_url

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="section-title">Tim Saya</h1>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/profile')} className="btn-secondary text-xs flex items-center gap-1.5 py-2">
              <Edit2 size={14} /> Edit tim
            </button>
            {needsResubmit && (
              <button onClick={resubmitTeam} className="btn-primary text-xs flex items-center gap-1.5 py-2">
                <Send size={14} /> Kirim ulang ke admin
              </button>
            )}
          </div>
        )}
      </div>

      {team.status === 'pending' && (
        <div className="p-4 rounded-xl bg-accent-yellow/10 border border-accent-yellow/25 flex items-start gap-3">
          <Send className="text-accent-yellow shrink-0 mt-0.5" size={18} />
          <div>
            <div className="text-accent-yellow font-semibold text-sm">Menunggu persetujuan</div>
            <p className="text-white/50 text-xs mt-0.5">Admin akan menerima atau menolak pendaftaran tim ini. Saat menunggu, tim tidak bisa diedit.</p>
          </div>
        </div>
      )}

      {team.status === 'rejected' && (
        <div className="p-4 rounded-xl bg-accent-red/10 border border-accent-red/20 flex items-start gap-3">
          <AlertCircle className="text-accent-red shrink-0 mt-0.5" size={18} />
          <div>
            <div className="text-accent-red font-semibold text-sm">Pendaftaran ditolak</div>
            <p className="text-white/50 text-xs mt-0.5">Perbaiki nama tim jika perlu, lalu kirim ulang ke admin untuk ditinjau lagi.</p>
          </div>
        </div>
      )}

      <div className="card p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-2xl font-display font-bold text-brand-400 overflow-hidden">
          {avatar
            ? <img src={avatar} alt="logo" className="w-full h-full object-cover" />
            : team.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold">{team.name}</h1>
            <span className={statusBadge[team.status] || 'badge-gray'}>
              {team.status === 'approved'
                ? <CheckCircle size={14} className="inline" />
                : statusLabel[team.status] || team.status}
            </span>
          </div>
          <p className="text-white/40 text-sm mt-1 flex items-center gap-1">
            <User size={13} /> eFootball mobile — identitas tim di kompetisi ini
          </p>
        </div>
      </div>

      {modal === 'team' && (
        <CreateTeamModal onClose={() => setModal(null)} onCreated={() => { setModal(null); fetchMyTeam() }} />
      )}
    </div>
  )
}

function CreateTeamModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('teams').insert({
      name: name.trim(),
      owner_id: user.id,
      status: 'pending'
    })
    if (error) setError(error.message)
    else onCreated()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
        <h2 className="font-display font-bold text-lg mb-4">Daftar tim</h2>
        <p className="text-white/50 text-xs mb-4">
          Tim langsung masuk status <strong className="text-white/70">menunggu persetujuan</strong> admin. Setelah disetujui, tim tampil di daftar kompetisi.
        </p>
        {error && <p className="text-accent-red text-xs mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1.5 block">Nama Tim</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Nama tim kamu" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Batal</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm">
              {loading ? 'Mengirim...' : 'Kirim ke admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
