import { useState, useEffect } from 'react'
import { Trash2, Search, X, AlertTriangle, Crown, Users } from 'lucide-react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'

export default function ManageUsersTab() {
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null) // user object

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*, team:teams!owner_id(id, name, status, season_teams(season_id))')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function updateRole(userId, newRole) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (error) alert(error.message)
    else fetchUsers()
  }

  async function confirmDelete() {
    const u = deleteTarget
    setDeleteTarget(null)

    try {
      const { error } = await supabase.rpc('delete_user_cascade', { target_user_id: u.id })
      if (error) throw error
      fetchUsers()
    } catch (err) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.team?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-accent-yellow" />
        <h2 className="font-display font-semibold text-base">Pengguna & Tim ({users.length})</h2>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input pl-9 text-sm w-full" placeholder="Cari username atau nama tim..." />
      </div>

      {loading ? (
        <div className="card p-6 text-center text-white/30 text-sm">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-6 text-center text-white/30 text-sm">Tidak ada pengguna</div>
      ) : (
        <div className="card overflow-hidden divide-y divide-white/5">
          {filtered.map(u => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-3">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-400 font-display font-bold text-sm overflow-hidden shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  : u.username?.[0]?.toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{u.username}</span>
                  {u.role === 'admin' && <Crown size={12} className="text-accent-yellow" />}
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  {u.team ? (
                    <span>Tim: <span className="text-white/60">{u.team.name}</span></span>
                  ) : (
                    <span className="text-white/25">Belum punya tim</span>
                  )}
                  {u.whatsapp && <span className="ml-2">· WA: {u.whatsapp}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={u.role}
                  onChange={e => updateRole(u.id, e.target.value)}
                  className="input text-xs py-1.5 px-2.5 w-auto"
                >
                  <option value="admin">Admin</option>
                  <option value="player">Player</option>
                </select>
                <button onClick={() => setDeleteTarget(u)}
                  className="p-1.5 text-white/30 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Hapus Akun</h2>
              <button onClick={() => setDeleteTarget(null)} className="text-white/40 hover:text-white/80"><X size={18} /></button>
            </div>
            <p className="text-white/70 text-sm mb-1">
              Hapus akun <span className="text-white font-semibold">"{deleteTarget.username}"</span>?
            </p>
            {deleteTarget.team && (
              <p className="text-white/50 text-sm mb-3">
                Tim <span className="text-white/70 font-semibold">"{deleteTarget.team.name}"</span> juga akan ikut terhapus.
              </p>
            )}
            {deleteTarget.team?.season_teams?.length > 0 && (
              <div className="flex items-start gap-2 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg px-3 py-2.5 mb-3">
                <AlertTriangle size={15} className="text-accent-yellow shrink-0 mt-0.5" />
                <p className="text-accent-yellow/90 text-xs">
                  Tim ini terdaftar di {deleteTarget.team.season_teams.length} kompetisi. Jadwal pertandingan yang melibatkan tim ini akan ikut terhapus dan jadwal kompetisi tersebut jadi tidak lengkap.
                </p>
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 text-sm">Batal</button>
              <button onClick={confirmDelete} className="btn-danger flex-1 text-sm">Hapus</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
