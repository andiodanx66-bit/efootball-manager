import { useState, useEffect } from 'react'
import { Edit2, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import TeamFormModal from './TeamFormModal'

export default function ManageTeamsTab() {
  const [teams,        setTeams]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [isModalOpen,  setIsModalOpen]  = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [searchTerm,   setSearchTerm]   = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { fetchTeams() }, [])

  async function fetchTeams() {
    setLoading(true)
    const { data, error } = await supabase.from('teams')
      .select('*, owner:profiles!owner_id(username)')
      .order('created_at', { ascending: false })
    if (!error) setTeams(data || [])
    setLoading(false)
  }

  async function handleDeleteTeam(id) {
    if (!confirm('Yakin ingin menghapus tim ini?')) return
    const { error } = await supabase.from('teams').delete().eq('id', id)
    if (!error) setTeams(teams.filter(t => t.id !== id))
    else alert(`Gagal menghapus: ${error.message}`)
  }

  const filteredTeams = teams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const statusBadge = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' }
  const statusLabel = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="font-display font-semibold text-base flex items-center gap-2 mb-1" style={{color:'#0f172a'}}>
            <Users size={16} className="text-accent-yellow" /> Kelola Semua Tim ({teams.length})
          </h2>
          <p className="text-xs" style={{color:'#94a3b8'}}>
            Pemain mendaftar tim di menu <span style={{color:'#64748b'}}>Tim Saya</span>. Di sini Anda bisa ubah data tim.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Cari nama tim..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input flex-1 text-sm"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="input sm:w-44 text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        {loading ? (
          <div className="card p-6 text-center text-sm" style={{color:'#94a3b8'}}>Memuat data tim...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="card p-6 text-center text-sm" style={{color:'#94a3b8'}}>
            {teams.length === 0 ? 'Belum ada tim' : 'Tidak ada tim yang cocok'}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{borderBottom:'1px solid #e2e8f0', backgroundColor:'#f8fafc'}}>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{color:'#64748b'}}>Nama Tim</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{color:'#64748b'}}>Owner</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{color:'#64748b'}}>Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{color:'#64748b'}}>Dibuat</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{color:'#64748b'}}>Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{borderColor:'#e2e8f0'}}>
                  {filteredTeams.map(team => (
                    <tr key={team.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-xs font-bold font-display text-brand-600">
                            {team.name[0]}
                          </div>
                          <div className="font-medium text-sm" style={{color:'#0f172a'}}>{team.name}</div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm" style={{color:'#64748b'}}>{team.owner?.username || '-'}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={statusBadge[team.status] || 'badge-gray'}>
                          {statusLabel[team.status] ?? team.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm" style={{color:'#94a3b8'}}>
                          {new Date(team.created_at).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedTeam(team); setIsModalOpen(true) }}
                            className="p-1.5 rounded-lg transition-colors hover:bg-brand-50 hover:text-brand-600"
                            style={{color:'#94a3b8'}}
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50 hover:text-accent-red"
                            style={{color:'#94a3b8'}}
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
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

      <TeamFormModal
        isOpen={isModalOpen}
        team={selectedTeam}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchTeams}
      />
    </>
  )
}
