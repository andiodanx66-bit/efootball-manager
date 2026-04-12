import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, ChevronRight, Star, Swords, Plus, Trash2, CheckCircle } from 'lucide-react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import SeasonFormModal from '../components/admin/SeasonFormModal'

const typeLabel = { league: 'Liga', cup: 'Cup', champions: 'Champions' }
const typeIcon  = { league: Trophy, cup: Swords, champions: Star }
const typeBadge = { league: 'badge-blue', cup: 'badge-yellow', champions: 'badge-purple' }
const statusBadge = { draft: 'badge-gray', active: 'badge-green', finished: 'badge-red' }
const statusLabel = { draft: 'Draft', active: 'Berjalan', finished: 'Selesai' }

export default function SeasonsPage() {
  const { isAdmin } = useAuth()
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { fetchSeasons() }, [])

  async function fetchSeasons() {
    const { data } = await supabase
      .from('seasons')
      .select('*, created_by_profile:profiles!created_by(username)')
      .order('created_at', { ascending: false })
    setSeasons(data || [])
    setLoading(false)
  }

  const active   = seasons.filter(s => s.status === 'active')
  const others   = seasons.filter(s => s.status !== 'active')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="section-title">Kompetisi</h1>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Tambah Kompetisi
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-xs font-mono text-accent-green uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse-slow inline-block" />
                Sedang Berjalan
              </h2>
              <div className="space-y-3">
                {active.map(s => <SeasonCard key={s.id} season={s} isAdmin={isAdmin} onUpdate={fetchSeasons} />)}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">Lainnya</h2>
              <div className="space-y-3">
                {others.map(s => <SeasonCard key={s.id} season={s} isAdmin={isAdmin} onUpdate={fetchSeasons} />)}
              </div>
            </div>
          )}

          {seasons.length === 0 && (
            <div className="card p-12 text-center">
              <Trophy size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40">Belum ada kompetisi</p>
              <p className="text-white/25 text-xs mt-2">Admin dapat menambahkannya dari panel admin.</p>
            </div>
          )}
        </>
      )}

      {showForm && (
        <SeasonFormModal
          season={null}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchSeasons() }}
        />
      )}
    </div>
  )
}

function SeasonCard({ season, isAdmin, onUpdate }) {
  const navigate = useNavigate()
  const Icon = typeIcon[season.type] || Trophy
  const [deleteModal, setDeleteModal] = useState(false)

  async function handleFinish(e) {
    e.preventDefault()
    await supabase.from('seasons').update({ status: 'finished' }).eq('id', season.id)
    onUpdate()
  }

  async function handleDelete() {
    setDeleteModal(false)
    await supabase.from('seasons').delete().eq('id', season.id)
    onUpdate()
  }

  return (
    <>
      <div className="card-hover p-5 flex items-center gap-4">
        <Link to={`/seasons/${season.id}`} className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            season.type === 'champions' ? 'bg-accent-purple/20 text-accent-purple' :
            season.type === 'cup'       ? 'bg-accent-yellow/20 text-accent-yellow' :
                                          'bg-brand-500/20 text-brand-400'
          }`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-base">{season.name}</div>
            <div className="text-xs text-white/40 mt-0.5">
              {typeLabel[season.type]} · Dibuat oleh {season.created_by_profile?.username || 'Admin'}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && season.status === 'active' && (
            <button onClick={handleFinish}
              className="p-1.5 text-white/30 hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors" title="Tandai Selesai">
              <CheckCircle size={16} />
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setDeleteModal(true)}
              className="p-1.5 text-white/30 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors" title="Hapus">
              <Trash2 size={16} />
            </button>
          )}
          <Link to={`/seasons/${season.id}`}>
            <ChevronRight size={16} className="text-white/30" />
          </Link>
        </div>
      </div>

      {deleteModal && createPortal(
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal(false)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg mb-2">Hapus Kompetisi</h2>
            <p className="text-white/60 text-sm mb-1">Yakin ingin menghapus <span className="text-white font-semibold">{season.name}</span>?</p>
            <p className="text-white/40 text-xs mb-5">Semua jadwal, hasil, tim terdaftar, dan klasemen akan ikut terhapus.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(false)} className="btn-secondary flex-1 text-sm">Batal</button>
              <button onClick={handleDelete} className="btn-danger flex-1 text-sm">Hapus</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
