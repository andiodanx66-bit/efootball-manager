import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trophy, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function compressImage(file, maxSize = 768, quality = 0.88) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/webp', quality)
    }
    img.src = url
  })
}

const defaultForm = {
  title: '',
  season_group: '',
  season_id: '',
  team_id: '',
}

function getUniqueSeasonGroups(seasons) {
  const groups = []
  const seen = new Set()
  seasons.forEach(s => {
    if (s.season_group && !seen.has(s.season_group)) {
      seen.add(s.season_group)
      groups.push(s.season_group)
    }
  })
  return groups.reverse()
}

export default function TrofiPage() {
  const { user, isAdmin } = useAuth()
  const [trophies, setTrophies] = useState([])
  const [seasons, setSeasons] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentGroupIndex, setCurrentGroupIndex] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: trophyData }, { data: seasonData }, { data: teamData }] = await Promise.all([
      supabase
        .from('trophies')
        .select('id, title, image_url, created_at, team:teams(id, name, logo_url), season:seasons(id, name, logo_url, season_group)')
        .order('created_at', { ascending: false }),
      supabase
        .from('seasons')
        .select('id, name, logo_url, status, season_group')
        .order('created_at', { ascending: false }),
      supabase
        .from('teams')
        .select('id, name, logo_url')
        .eq('status', 'approved')
        .order('name'),
    ])
    setTrophies(trophyData || [])
    setSeasons(seasonData || [])
    setTeams(teamData || [])
    if (seasonData?.length) {
      const groups = getUniqueSeasonGroups(seasonData)
      if (groups.length) {
        // Cari season yang sedang aktif, lalu set groupnya sebagai default
        const activeSeason = seasonData.find(s => s.status === 'active')
        if (activeSeason && activeSeason.season_group) {
          const activeIndex = groups.indexOf(activeSeason.season_group)
          setCurrentGroupIndex(activeIndex !== -1 ? activeIndex : groups.length - 1)
        } else {
          setCurrentGroupIndex(groups.length - 1)
        }
      }
    }
    setLoading(false)
  }

  const seasonGroups = getUniqueSeasonGroups(seasons)
  const currentSeasonGroup = seasonGroups[currentGroupIndex] || null
  const filteredSeasons = form.season_group ? seasons.filter(s => s.season_group === form.season_group) : []

  function getCurrentGroupTrophies() {
    if (currentGroupIndex === null || !currentSeasonGroup) return trophies
    return trophies.filter(t => t.season?.season_group === currentSeasonGroup)
  }

  function nextSeasonGroup() {
    if (currentGroupIndex < seasonGroups.length - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1)
    }
  }

  function prevSeasonGroup() {
    if (currentGroupIndex > 0) {
      setCurrentGroupIndex(currentGroupIndex - 1)
    }
  }

  function closeForm() {
    setShowForm(false)
    setForm(defaultForm)
    setFile(null)
    setPreview(null)
    setError('')
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isAdmin) {
      setError('Hanya admin yang bisa menambahkan trofi.')
      return
    }
    if (!file) {
      setError('Gambar piala wajib diupload.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const compressed = await compressImage(file)
      const fileName = `trophies/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      const { error: uploadError } = await supabase.storage
        .from('competition')
        .upload(fileName, compressed, { contentType: 'image/webp' })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('competition').getPublicUrl(fileName)
      const image_url = `${data.publicUrl}?t=${Date.now()}`

      const { error: insertError } = await supabase.from('trophies').insert({
        title: form.title.trim() || 'Juara',
        season_id: form.season_id,
        team_id: form.team_id,
        image_url,
        created_by: user.id,
      })
      if (insertError) throw insertError

      closeForm()
      fetchData()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan trofi.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(trophy) {
    if (!isAdmin) return
    if (!window.confirm('Hapus trofi ini? Gambar di storage juga akan dihapus.')) return
    
    try {
      if (trophy.image_url) {
        const url = new URL(trophy.image_url)
        const pathParts = url.pathname.split('/storage/v1/object/public/competition/')
        if (pathParts.length === 2) {
          const filePath = pathParts[1].split('?')[0]
          await supabase.storage.from('competition').remove([filePath])
        }
      }
      
      const { error: deleteError } = await supabase.from('trophies').delete().eq('id', trophy.id)
      if (deleteError) throw deleteError
      
      fetchData()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="section-title">Trofi</h1>
          <p className="text-ink-muted text-sm mt-1">Daftar piala, tim juara, dan kompetisi yang dimenangkan</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary text-sm px-4 flex items-center gap-2"
          >
            <Plus size={16} />
            Tambah Trofi
          </button>
        )}
      </div>

      {!loading && seasonGroups.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={nextSeasonGroup}
            disabled={currentGroupIndex === seasonGroups.length - 1}
            className={`p-2 rounded-lg transition-all ${
              currentGroupIndex === seasonGroups.length - 1
                ? 'text-ink-faint cursor-not-allowed'
                : 'text-ink hover:bg-surface-muted'
            }`}
            title="Season sebelumnya"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center flex-1">
            <p className="font-display font-bold text-lg text-ink">{currentSeasonGroup || 'Semua'}</p>
          </div>
          <button
            type="button"
            onClick={prevSeasonGroup}
            disabled={currentGroupIndex === 0}
            className={`p-2 rounded-lg transition-all ${
              currentGroupIndex === 0
                ? 'text-ink-faint cursor-not-allowed'
                : 'text-ink hover:bg-surface-muted'
            }`}
            title="Season selanjutnya"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, idx) => (
            <div key={idx} className="space-y-3">
              <div className="aspect-square bg-surface-border rounded-xl animate-pulse" />
              <div className="h-3 bg-surface-border rounded-full animate-pulse" />
              <div className="h-2 bg-surface-border rounded-full w-2/3 animate-pulse" />
            </div>
          ))}
        </div>
      ) : getCurrentGroupTrophies().length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy size={40} className="text-ink-faint mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-ink">Belum ada trofi untuk season ini</p>
          <p className="text-xs text-ink-faint mt-1">Admin bisa menambahkan piala, tim juara, dan nama kompetisinya dari sini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {getCurrentGroupTrophies().map((item) => (
            <div key={item.id} className="space-y-3">
              <div className="aspect-square bg-surface-muted rounded-xl overflow-hidden shadow-md">
                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-brand-600 font-semibold">{item.title}</p>
                <p className="font-display font-bold text-lg text-ink line-clamp-2">{item.team?.name || '-'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-ink-muted truncate flex-1">{item.season?.name || '-'}</p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="p-1 rounded text-ink-faint hover:text-accent-red hover:bg-accent-red/10 transition-all"
                      title="Hapus trofi"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-lg flex items-center gap-2 text-ink">
                <Trophy size={18} className="text-brand-600" />
                Tambah Trofi
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-1 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <p className="text-accent-red text-xs mb-4 rounded-lg p-3 bg-accent-red/10 border border-accent-red/20">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-28 h-28 rounded-2xl bg-brand-50 border-2 border-dashed border-brand-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-brand-500 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {preview
                    ? <img src={preview} alt="preview trofi" className="w-full h-full object-cover" />
                    : <Trophy size={40} className="text-brand-300" />}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-ink-faint hover:text-ink transition-colors"
                >
                  {preview ? 'Ganti gambar piala' : 'Upload gambar piala'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div>
                <label className="text-sm text-ink-muted mb-1.5 block">Season</label>
                <select
                  value={form.season_group}
                  onChange={(e) => setForm((prev) => ({ ...prev, season_group: e.target.value, season_id: '' }))}
                  className="input"
                  required
                >
                  <option value="">Pilih season</option>
                  {seasonGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              {form.season_group && (
                <div>
                  <label className="text-sm text-ink-muted mb-1.5 block">Nama Kompetisi</label>
                  <select
                    value={form.season_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, season_id: e.target.value }))}
                    className="input"
                    required
                  >
                    <option value="">Pilih kompetisi</option>
                    {filteredSeasons.map((season) => (
                      <option key={season.id} value={season.id}>{season.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm text-ink-muted mb-1.5 block">Label Trofi</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="input"
                  placeholder="Juara 1"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-ink-muted mb-1.5 block">Nama Tim</label>
                <select
                  value={form.team_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, team_id: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Pilih tim</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full text-sm">
                {saving ? 'Menyimpan...' : 'Simpan Trofi'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
