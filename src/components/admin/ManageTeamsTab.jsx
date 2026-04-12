import { useState, useEffect } from 'react'
import { Edit2, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import TeamFormModal from './TeamFormModal'

export default function ManageTeamsTab() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    fetchTeams()
  }, [])

  async function fetchTeams() {
    setLoading(true)
    const { data, error } = await supabase.from('teams')
      .select('*, owner:profiles!owner_id(username)')
      .order('created_at', { ascending: false })

    if (!error) {
      setTeams(data || [])
    }
    setLoading(false)
  }

  function handleEditTeam(team) {
    setSelectedTeam(team)
    setIsModalOpen(true)
  }

  async function handleDeleteTeam(id) {
    if (!confirm('Yakin ingin menghapus tim ini?')) return

    const { error } = await supabase.from('teams').delete().eq('id', id)

    if (!error) {
      setTeams(teams.filter(t => t.id !== id))
    } else {
      alert(`Gagal menghapus: ${error.message}`)
    }
  }

  function handleSave() {
    fetchTeams()
  }

  // Filter teams based on search and status
  const filteredTeams = teams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const statusColors = {
    pending: 'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red'
  }

  const statusLabels = {
    pending: 'Menunggu persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak'
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-base flex items-center gap-2 mb-2">
              <Users size={16} className="text-accent-yellow" /> Kelola Semua Tim ({teams.length})
            </h2>
            <p className="text-xs text-white/40">
              Pemain mendaftar tim di menu <span className="text-white/60">Tim Saya</span> (langsung menunggu persetujuan). Di sini Anda terima/tolak atau ubah data tim.
            </p>
          </div>
        </div>

        {/* Search and Filter */}
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
            className="input sm:w-40 text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu persetujuan</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        {/* Teams List */}
        {loading ? (
          <div className="card p-6 text-center text-white/30 text-sm">Memuat data tim...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="card p-6 text-center text-white/30 text-sm">
            {teams.length === 0 ? 'Belum ada tim' : 'Tidak ada tim yang cocok dengan filter'}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Nama Tim</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Owner</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-white/50 uppercase">Dibuat</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-white/50 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTeams.map(team => (
                    <tr key={team.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold font-display text-brand-400">
                            {team.name[0]}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{team.name}</div>
                            {team.logo_url && (
                              <div className="text-xs text-white/40 truncate">Logo: {team.logo_url}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm text-white/70">{team.owner?.username || '-'}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-lg ${statusColors[team.status] || 'badge-gray'}`}>
                          {statusLabels[team.status] ?? team.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm text-white/50">
                          {new Date(team.created_at).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditTeam(team)}
                            className="p-1.5 text-white/40 hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id)}
                            className="p-1.5 text-white/40 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors"
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
        onSave={handleSave}
      />
    </>
  )
}
