import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ChevronRight, Star, Swords, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import SeasonFormModal from '../components/admin/SeasonFormModal'

const typeIcon = { league: Trophy, cup: Swords, champions: Star }

export default function SeasonsPage() {
  const { isAdmin } = useAuth()
  const [seasons, setSeasons]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [fabMenuOpen, setFabMenuOpen] = useState(false)

  useEffect(() => { fetchSeasons() }, [])

  useEffect(() => {
    if (!fabMenuOpen) return
    function onKey(e) {
      if (e.key === 'Escape') setFabMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fabMenuOpen])

  async function fetchSeasons() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('created_at', { ascending: false })
    setSeasons(data || [])
    setLoading(false)
  }

  const active = seasons.filter(s => s.status === 'active')
  const others = seasons.filter(s => s.status !== 'active')

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <div className="flex items-center justify-between">
        <h1 className="section-title">Kompetisi</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map(s => (
                <SeasonCard key={s.id} season={s} editMode={editMode && isAdmin} onUpdate={fetchSeasons} />
              ))}
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">Lainnya</h2>
              <div className="space-y-3">
                {others.map(s => (
                  <SeasonCard key={s.id} season={s} editMode={editMode && isAdmin} onUpdate={fetchSeasons} />
                ))}
              </div>
            </div>
          )}

          {seasons.length === 0 && (
            <div className="card p-12 text-center">
              <Trophy size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40">Belum ada kompetisi</p>
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

      {/* FAB: pensil → menu Edit / Tambah */}
      {isAdmin && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
          {fabMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-[35] bg-black/20"
                aria-hidden
                onClick={() => setFabMenuOpen(false)}
              />
              <div
                role="menu"
                className="relative z-[45] mb-1 min-w-[11rem] rounded-xl border border-white/10 bg-[#12141c] py-1 shadow-xl animate-slide-in"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setEditMode(e => !e)
                    setFabMenuOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-display font-semibold text-left transition-colors
                    ${editMode ? 'text-accent-yellow hover:bg-accent-yellow/10' : 'text-white/90 hover:bg-white/10'}`}
                >
                  <Pencil size={16} className="shrink-0 opacity-80" />
                  {editMode ? 'Selesai edit' : 'Edit'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowForm(true)
                    setFabMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-display font-semibold text-left text-white/90 hover:bg-white/10 transition-colors border-t border-white/5"
                >
                  <Plus size={16} className="shrink-0 opacity-80" />
                  Tambah
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setFabMenuOpen(o => !o)}
            aria-expanded={fabMenuOpen}
            aria-haspopup="menu"
            className={`w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95
              ${editMode
                ? 'bg-accent-yellow/80 hover:bg-accent-yellow shadow-accent-yellow/30 ring-2 ring-accent-yellow/40'
                : fabMenuOpen
                  ? 'bg-brand-500 shadow-brand-600/40'
                  : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/40'}`}
            title="Edit atau tambah kompetisi"
          >
            <Pencil size={22} />
          </button>
        </div>
      )}
    </div>
  )
}

function SeasonCard({ season, editMode, onUpdate }) {
  const Icon = typeIcon[season.type] || Trophy
  const [renaming, setRenaming]     = useState(false)
  const [newName, setNewName]       = useState(season.name)
  const [saving, setSaving]         = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)

  async function handleRename() {
    if (!newName.trim() || newName.trim() === season.name) { setRenaming(false); return }
    setSaving(true)
    await supabase.from('seasons').update({ name: newName.trim() }).eq('id', season.id)
    setSaving(false)
    setRenaming(false)
    onUpdate()
  }

  async function handleDelete() {
    setDeleteModal(false)
    await supabase.from('seasons').delete().eq('id', season.id)
    onUpdate()
  }

  return (
    <>
      {editMode ? (
        <div className={`card-hover p-4 flex items-center gap-3 border-accent-yellow/20`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            season.type === 'champions' ? 'bg-accent-purple/20 text-accent-purple' :
            season.type === 'cup'       ? 'bg-accent-yellow/20 text-accent-yellow' :
                                          'bg-brand-500/20 text-brand-400'
          }`}>
            <Icon size={20} />
          </div>

          <div className="flex-1 min-w-0">
            {renaming ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
                  className="input py-1 text-sm font-display font-semibold"
                />
                <button onClick={handleRename} disabled={saving} className="text-accent-green hover:text-accent-green/70 shrink-0">
                  <Check size={16} />
                </button>
                <button onClick={() => { setRenaming(false); setNewName(season.name) }} className="text-white/40 hover:text-white shrink-0">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="font-display font-semibold text-base truncate">{season.name}</div>
            )}
          </div>

          {!renaming && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setRenaming(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
              >
                <Pencil size={12} /> Rename
              </button>
              <button
                onClick={() => setDeleteModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-accent-red/10 hover:bg-accent-red/20 text-accent-red transition-colors border border-accent-red/20"
              >
                <Trash2 size={12} /> Hapus
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link to={`/seasons/${season.id}`} className="card-hover p-4 flex items-center gap-3 block">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            season.type === 'champions' ? 'bg-accent-purple/20 text-accent-purple' :
            season.type === 'cup'       ? 'bg-accent-yellow/20 text-accent-yellow' :
                                          'bg-brand-500/20 text-brand-400'
          }`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-base truncate">{season.name}</div>
          </div>
          <ChevronRight size={16} className="text-white/30 shrink-0" />
        </Link>
      )}

      {deleteModal && createPortal(
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal(false)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg mb-2">Hapus Kompetisi</h2>
            <p className="text-white/60 text-sm mb-1">Yakin ingin menghapus <span className="text-white font-semibold">{season.name}</span>?</p>
            <p className="text-white/40 text-xs mb-5">Semua jadwal, hasil, tim terdaftar, dan klasemen akan ikut terhapus permanen.</p>
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
