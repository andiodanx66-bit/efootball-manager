import { useState, useEffect } from 'react'
import { Crown, Shield, Users, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AdminManagementTab() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  useEffect(() => {
    fetchProfiles()
  }, [])

  async function fetchProfiles() {
    setLoading(true)
    const { data, error } = await supabase.from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) {
      setProfiles(data || [])
    }
    setLoading(false)
  }

  async function updateUserRole(userId, newRole) {
    const { error } = await supabase.from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (!error) {
      fetchProfiles()
    } else {
      alert(`Gagal update role: ${error.message}`)
    }
  }

  // Filter profiles
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    const matchesRole = filterRole === 'all' || p.role === filterRole
    return matchesSearch && matchesRole
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-base flex items-center gap-2 mb-2">
            <Shield size={16} className="text-accent-yellow" /> Kelola Admin & Pengguna ({profiles.length})
          </h2>
          <p className="text-xs text-white/40">Ubah role pengguna antara Admin dan Player</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Cari username atau nama..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input flex-1 text-sm"
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="input sm:w-40 text-sm"
        >
          <option value="all">Semua Role</option>
          <option value="admin">Admin</option>
          <option value="player">Player</option>
        </select>
      </div>

      {/* Profiles Table */}
      {loading ? (
        <div className="card p-6 text-center text-white/30 text-sm">Memuat data pengguna...</div>
      ) : filteredProfiles.length === 0 ? (
        <div className="card p-6 text-center text-white/30 text-sm">
          {profiles.length === 0 ? 'Belum ada pengguna' : 'Tidak ada pengguna yang cocok dengan filter'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Username</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Nama Lengkap</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Terdaftar</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProfiles.map(profile => (
                  <tr key={profile.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold font-display text-brand-400">
                          {profile.username[0].toUpperCase()}
                        </div>
                        <div className="text-sm font-medium">{profile.username}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm text-white/70">{profile.full_name || '-'}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {profile.role === 'admin' && (
                          <Crown size={14} className="text-accent-yellow" />
                        )}
                        <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-lg ${
                          profile.role === 'admin'
                            ? 'bg-accent-yellow/20 text-accent-yellow'
                            : 'bg-white/10 text-white/50'
                        }`}>
                          {profile.role === 'admin' ? 'Admin' : 'Player'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm text-white/50">
                        {new Date(profile.created_at).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {profile.role === 'player' ? (
                          <button
                            onClick={() => updateUserRole(profile.id, 'admin')}
                            className="px-3 py-1.5 text-xs bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30 rounded-lg transition-colors flex items-center gap-1"
                            title="Set as admin"
                          >
                            <Crown size={13} /> Jadikan Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => updateUserRole(profile.id, 'player')}
                            className="px-3 py-1.5 text-xs bg-white/10 text-white/50 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1"
                            title="Set as player"
                          >
                            <Users size={13} /> Jadikan Player
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
