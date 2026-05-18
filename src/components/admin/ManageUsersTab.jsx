import { useState, useEffect } from 'react'
import { Trash2, Search, X, AlertTriangle, Crown, Users } from 'lucide-react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'

export default function ManageUsersTab() {
  const [users,        setUsers]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

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
        <h2 className="font-display font-semibold text-base" style={{color:'#0f172a'}}>
          Pengguna & Tim ({users.length})
        </h2>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'#94a3b8'}} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input pl-9 text-sm w-full" placeholder="Cari username atau nama tim..." />
      </div>

      {loading ? (
        <div className="card p-6 text-center text-sm" style={{color:'#94a3b8'}}>Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-6 text-center text-sm" style={{color:'#94a3b8'}}>Tidak ada pengguna</div>
      ) : (
        <div className="card overflow-hidden divide-y" style={{borderColor:'#e2e8f0'}}>
          {filtered.map(u => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center text-brand-600 font-display font-bold text-sm overflow-hidden shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  : u.username?.[0]?.toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm" style={{color:'#0f172a'}}>{u.username}</span>
                  {u.role === 'admin' && <Crown size={12} className="text-accent-yellow" />}
                </div>
                <div className="text-xs mt-0.5" style={{color:'#94a3b8'}}>
                  {u.team ? (
                    <span>Tim: <span style={{color:'#64748b'}}>{u.team.name}</span></span>
                  ) : (
                    <span>Belum punya tim</span>
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
                  className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                  style={{color:'#94a3b8'}}
                  onMouseEnter={e => e.currentTarget.style.color='#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color='#94a3b8'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg" style={{color:'#0f172a'}}>Hapus Akun</h2>
              <button onClick={() => setDeleteTarget(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors" style={{color:'#94a3b8'}}>
                <X size={18} />
              </button>
            </div>
            <p className="text-sm mb-1" style={{color:'#64748b'}}>
              Hapus akun <span className="font-semibold" style={{color:'#0f172a'}}>"{deleteTarget.username}"</span>?
            </p>
            {deleteTarget.team && (
              <p className="text-sm mb-3" style={{color:'#64748b'}}>
                Tim <span className="font-semibold" style={{color:'#0f172a'}}>"{deleteTarget.team.name}"</span> juga akan ikut terhapus.
              </p>
            )}
            {deleteTarget.team?.season_teams?.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-3" style={{backgroundColor:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)'}}>
                <AlertTriangle size={15} className="text-accent-yellow shrink-0 mt-0.5" />
                <p className="text-xs text-accent-yellow">
                  Tim ini terdaftar di {deleteTarget.team.season_teams.length} kompetisi. Jadwal pertandingan yang melibatkan tim ini akan ikut terhapus.
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
