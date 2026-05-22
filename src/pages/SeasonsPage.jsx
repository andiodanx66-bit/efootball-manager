import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ChevronRight, Star, Swords, Plus, Trash2, Pencil, Check, X, Archive, Play, Layers, ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import SeasonFormModal from '../components/admin/SeasonFormModal'

const typeIcon  = { league: Trophy, cup: Swords, champions: Star }
const typeLabel = { league: 'Liga', cup: 'Cup', champions: 'Champions' }

// Kelompokkan array seasons berdasarkan season_group
// Kompetisi tanpa group masuk ke key null (tampil tanpa header)
function groupBySeasonGroup(seasons) {
  const map = {}
  seasons.forEach(s => {
    const key = s.season_group || null
    if (!map[key]) map[key] = []
    map[key].push(s)
  })
  // Urutkan: group bernama dulu (sort asc), null terakhir
  const sorted = Object.entries(map).sort(([a], [b]) => {
    if (a === 'null' || a === null) return 1
    if (b === 'null' || b === null) return -1
    return a.localeCompare(b)
  })
  return sorted
}

export default function SeasonsPage() {
  const { isAdmin } = useAuth()
  const [seasons,     setSeasons]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editMode,    setEditMode]    = useState(false)
  const [view,        setView]        = useState('active')
  const [fabMenuOpen, setFabMenuOpen] = useState(false)
  const [collapsed,   setCollapsed]   = useState({})   // { [groupKey]: true/false }

  function toggleCollapse(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => { fetchSeasons() }, [])

  useEffect(() => {
    if (!fabMenuOpen) return
    function onKey(e) { if (e.key === 'Escape') setFabMenuOpen(false) }
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

  const activeSeasons   = seasons.filter(s => s.status === 'active' || s.status === 'draft')
  const finishedSeasons = seasons.filter(s => s.status === 'finished')
  const displayed       = view === 'active' ? activeSeasons : finishedSeasons
  const grouped         = groupBySeasonGroup(displayed)

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <div>
        <h1 className="section-title">Kompetisi</h1>
        <p className="text-ink-muted text-sm mt-1">Semua turnamen dan liga yang diselenggarakan</p>
      </div>

      {/* Tab: Aktif / Selesai */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{backgroundColor:'#f1f5f9'}}>
        <button
          onClick={() => setView('active')}
          className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all flex items-center gap-1.5 ${
            view === 'active' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Play size={13} /> Aktif
        </button>
        <button
          onClick={() => setView('finished')}
          className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all flex items-center gap-1.5 ${
            view === 'finished' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Archive size={13} /> Selesai
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card p-12 text-center">
          {view === 'active' ? (
            <>
              <Trophy size={40} className="text-ink-faint mx-auto mb-3" />
              <p className="text-ink-faint">Belum ada kompetisi aktif</p>
            </>
          ) : (
            <>
              <Archive size={40} className="text-ink-faint mx-auto mb-3" />
              <p className="text-ink-faint">Belum ada kompetisi yang selesai</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([groupKey, groupSeasons]) => {
            const isNamed     = groupKey && groupKey !== 'null'
            const isCollapsed = isNamed && collapsed[groupKey]
            return (
              <div key={groupKey ?? '__ungrouped__'} className="space-y-3">
                {/* Header grup musim — hanya tampil kalau ada nama */}
                {isNamed && (
                  <button
                    onClick={() => toggleCollapse(groupKey)}
                    className="w-full flex items-center gap-2 group"
                  >
                    <Layers size={14} className="text-brand-600 shrink-0" />
                    <span className="font-display font-semibold text-sm text-brand-600">{groupKey}</span>
                    <div className="flex-1 h-px bg-surface-border" />
                    <span className="text-xs text-ink-faint font-mono shrink-0">{groupSeasons.length}</span>
                    <ChevronDown
                      size={14}
                      className={`text-ink-faint shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                )}
                {!isCollapsed && groupSeasons.map(s => (
                  <SeasonCard
                    key={s.id}
                    season={s}
                    editMode={editMode && isAdmin}
                    onUpdate={fetchSeasons}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <SeasonFormModal
          season={null}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchSeasons() }}
        />
      )}

      {/* FAB */}
      {isAdmin && (
        <div className="fixed bottom-[calc(4rem+1.5rem)] lg:bottom-6 right-6 z-40 flex flex-col items-end gap-2">
          {fabMenuOpen && (
            <>
              <div className="fixed inset-0 z-[35] bg-black/20" aria-hidden onClick={() => setFabMenuOpen(false)} />
              <div role="menu" className="relative z-[45] mb-1 min-w-[11rem] rounded-xl border border-surface-border bg-white py-1 shadow-card-md animate-slide-in">
                <button
                  type="button" role="menuitem"
                  onClick={() => { setEditMode(e => !e); setFabMenuOpen(false) }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-display font-semibold text-left transition-colors
                    ${editMode ? 'text-accent-yellow hover:bg-accent-yellow/10' : 'text-ink hover:bg-surface-muted'}`}
                >
                  <Pencil size={16} className="shrink-0 opacity-80" />
                  {editMode ? 'Selesai edit' : 'Edit'}
                </button>
                <button
                  type="button" role="menuitem"
                  onClick={() => { setShowForm(true); setFabMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-display font-semibold text-left text-ink hover:bg-surface-muted transition-colors border-t border-surface-border"
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

function compressImage(file, maxSize = 256, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width  = img.width  * ratio
      canvas.height = img.height * ratio
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/webp', quality)
    }
    img.src = url
  })
}

function SeasonCard({ season, editMode, onUpdate }) {
  const Icon = typeIcon[season.type] || Trophy
  const [renaming,      setRenaming]      = useState(false)
  const [newName,       setNewName]       = useState(season.name)
  const [newGroup,      setNewGroup]      = useState(season.season_group || '')
  const [editingGroup,  setEditingGroup]  = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [statusSaving,  setStatusSaving]  = useState(false)
  const [deleteModal,   setDeleteModal]   = useState(false)
  const [editingLogo,   setEditingLogo]   = useState(false)
  const [logoFile,      setLogoFile]      = useState(null)
  const [logoPreview,   setLogoPreview]   = useState(null)
  const [logoSaving,    setLogoSaving]    = useState(false)
  const logoFileRef = useRef()

  async function handleRename() {
    if (!newName.trim() || newName.trim() === season.name) { setRenaming(false); return }
    setSaving(true)
    await supabase.from('seasons').update({ name: newName.trim() }).eq('id', season.id)
    setSaving(false)
    setRenaming(false)
    onUpdate()
  }

  async function handleGroupSave() {
    setSaving(true)
    await supabase.from('seasons').update({ season_group: newGroup.trim() || null }).eq('id', season.id)
    setSaving(false)
    setEditingGroup(false)
    onUpdate()
  }

  async function handleStatusChange(newStatus) {
    setStatusSaving(true)
    await supabase.from('seasons').update({ status: newStatus }).eq('id', season.id)
    setStatusSaving(false)
    onUpdate()
  }

  async function handleDelete() {
    setDeleteModal(false)
    await supabase.from('seasons').delete().eq('id', season.id)
    onUpdate()
  }

  function handleLogoFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setLogoFile(f)
    setLogoPreview(URL.createObjectURL(f))
  }

  async function handleLogoSave() {
    if (!logoFile) { setEditingLogo(false); return }
    setLogoSaving(true)
    try {
      const compressed = await compressImage(logoFile)
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.webp`
      const { error: uploadError } = await supabase.storage
        .from('competition')
        .upload(fileName, compressed, { contentType: 'image/webp' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('competition').getPublicUrl(fileName)
      const logo_url = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('seasons').update({ logo_url }).eq('id', season.id)
      onUpdate()
      setEditingLogo(false)
      setLogoFile(null)
      setLogoPreview(null)
    } catch (err) {
      console.error(err)
    } finally {
      setLogoSaving(false)
    }
  }

  const iconBg =
    season.type === 'champions' ? 'bg-accent-purple/20 text-accent-purple' :
    season.type === 'cup'       ? 'bg-accent-yellow/20 text-accent-yellow' :
                                  'bg-brand-500/20 text-brand-400'

  function renderIcon() {
    if (editMode && editingLogo) {
      const currentPreview = logoPreview || season.logo_url
      return (
        <div className="flex flex-col items-center gap-2 mt-0.5">
          <div
            className="w-14 h-14 rounded-xl bg-brand-50 border-2 border-dashed border-brand-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-brand-500 transition-colors"
            onClick={() => logoFileRef.current.click()}
          >
            {currentPreview
              ? <img src={currentPreview} alt="logo" className="w-full h-full object-cover" />
              : <Trophy size={28} className="text-brand-300" />}
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleLogoSave}
              disabled={logoSaving || !logoFile}
              className="text-accent-green hover:text-accent-green/70 disabled:opacity-50"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => { setEditingLogo(false); setLogoFile(null); setLogoPreview(null); }}
              className="text-ink-faint hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
          <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
        </div>
      )
    }

    if (season.logo_url) {
      return (
        <div className="flex flex-col items-center gap-1 mt-0.5">
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
            <img src={season.logo_url} alt={season.name} className="w-full h-full object-cover" />
          </div>
          {editMode && (
            <button
              onClick={() => setEditingLogo(true)}
              className="text-[10px] text-ink-faint hover:text-brand-600 transition-colors"
            >
              Ganti
            </button>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-1 mt-0.5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={20} />
        </div>
        {editMode && (
          <button
            onClick={() => setEditingLogo(true)}
            className="text-[10px] text-ink-faint hover:text-brand-600 transition-colors"
          >
            Tambah
          </button>
        )}
      </div>
    )
  }

  if (editMode) {
    return (
      <>
        <div className="card-hover p-4 flex items-start gap-3 border-accent-yellow/20">
          {renderIcon()}

          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Nama */}
            {renaming ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
                  className="input py-1 text-sm font-display font-semibold"
                />
                <button onClick={handleRename} disabled={saving} className="text-accent-green hover:text-accent-green/70 shrink-0"><Check size={16} /></button>
                <button onClick={() => { setRenaming(false); setNewName(season.name) }} className="text-ink-faint hover:text-ink shrink-0"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-semibold text-base text-ink">{season.name}</span>
                <StatusBadge status={season.status} />
              </div>
            )}

            {/* Musim (season_group) */}
            {editingGroup ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newGroup}
                  onChange={e => setNewGroup(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleGroupSave(); if (e.key === 'Escape') { setEditingGroup(false); setNewGroup(season.season_group || '') } }}
                  className="input py-1 text-xs"
                  placeholder="cth: Musim 1"
                />
                <button onClick={handleGroupSave} disabled={saving} className="text-accent-green hover:text-accent-green/70 shrink-0"><Check size={14} /></button>
                <button onClick={() => { setEditingGroup(false); setNewGroup(season.season_group || '') }} className="text-ink-faint hover:text-ink shrink-0"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={() => setEditingGroup(true)}
                className="flex items-center gap-1 text-xs text-ink-faint hover:text-brand-600 transition-colors"
              >
                <Layers size={11} />
                {season.season_group ? season.season_group : <span className="italic">Belum ada musim</span>}
                <Pencil size={10} className="opacity-50" />
              </button>
            )}
          </div>

          {!renaming && !editingGroup && (
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {season.status !== 'finished' ? (
                <button
                  onClick={() => handleStatusChange('finished')}
                  disabled={statusSaving}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-surface-muted hover:bg-slate-200 text-ink-muted hover:text-ink transition-colors border border-surface-border"
                >
                  <Archive size={12} /> Selesai
                </button>
              ) : (
                <button
                  onClick={() => handleStatusChange('active')}
                  disabled={statusSaving}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-accent-green/10 hover:bg-accent-green/20 text-accent-green transition-colors border border-accent-green/20"
                >
                  <Play size={12} /> Aktifkan
                </button>
              )}
              <button
                onClick={() => setRenaming(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-surface-muted hover:bg-surface-border text-ink-muted hover:text-ink transition-colors border border-surface-border"
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

        {deleteModal && createPortal(
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal(false)}>
            <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
              <h2 className="font-display font-bold text-lg mb-2 text-ink">Hapus Kompetisi</h2>
              <p className="text-ink-muted text-sm mb-1">Yakin ingin menghapus <span className="text-ink font-semibold">{season.name}</span>?</p>
              <p className="text-ink-faint text-xs mb-5">Semua jadwal, hasil, tim terdaftar, dan klasemen akan ikut terhapus permanen.</p>
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

  // Normal mode
  return (
    <>
      <Link to={`/seasons/${season.id}`} className="card-hover p-4 flex items-center gap-3 block">
        {renderIcon()}
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-base truncate text-ink">{season.name}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-ink-faint">{typeLabel[season.type] || season.type}</span>
            {season.status === 'active' && <StatusBadge status="active" />}
            {season.status === 'finished' && <StatusBadge status="finished" />}
          </div>
        </div>
        <ChevronRight size={16} className="text-ink-faint shrink-0" />
      </Link>

      {deleteModal && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal(false)}>
            <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
              <h2 className="font-display font-bold text-lg mb-2 text-ink">Hapus Kompetisi</h2>
              <p className="text-ink-muted text-sm mb-1">Yakin ingin menghapus <span className="text-ink font-semibold">{season.name}</span>?</p>
              <p className="text-ink-faint text-xs mb-5">Semua jadwal, hasil, tim terdaftar, dan klasemen akan ikut terhapus permanen.</p>
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

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
        Aktif
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-muted text-ink-faint">
        <Archive size={9} />
        Selesai
      </span>
    )
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-muted text-ink-faint">
        Draft
      </span>
    )
  }
  return null
}
