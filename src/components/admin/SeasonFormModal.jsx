import { useState, useEffect, useRef } from 'react'
import { Trophy, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

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

export default function SeasonFormModal({ season, onClose, onSaved }) {
  const { user, isAdmin } = useAuth()
  const [form,    setForm]    = useState({ name: '', type: 'league', legs: 1, num_groups: 4, num_divisions: 1, promotion_count: 0, relegation_count: 0, season_group: '', final_series_type: 'single', final_best_of: 1, logo_url: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const fileRef = useRef()

  const isEdit = Boolean(season?.id)

  useEffect(() => {
    if (season) {
      setForm({
        name:            season.name            || '',
        type:            season.type            || 'league',
        legs:            season.legs            || 1,
        num_groups:      season.num_groups      || 4,
        num_divisions:   season.num_divisions   || 1,
        promotion_count: season.promotion_count || 0,
        relegation_count: season.relegation_count || 0,
        status:          season.status          || 'active',
        season_group:    season.season_group    || '',
        final_series_type: season.final_series_type || 'single',
        final_best_of:   season.final_best_of   || 1,
        logo_url:        season.logo_url        || '',
      })
      setPreview(season.logo_url || null)
    } else {
      setForm({ name: '', type: 'league', legs: 1, num_groups: 4, num_divisions: 1, promotion_count: 0, relegation_count: 0, season_group: '', final_series_type: 'single', final_best_of: 1, logo_url: '' })
      setPreview(null)
    }
    setFile(null)
    setError('')
  }, [season])

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function update(k) {
    return e => {
      const val = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value
      setForm(p => ({ ...p, [k]: val }))
    }
  }

  function setNumDivisions(n) {
    const maxProRel = n > 1 ? n - 1 : 0
    setForm(p => ({
      ...p,
      num_divisions: n,
      promotion_count: p.promotion_count > maxProRel ? maxProRel : p.promotion_count,
      relegation_count: p.relegation_count > maxProRel ? maxProRel : p.relegation_count,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isAdmin) { setError('Hanya admin yang dapat mengubah kompetisi.'); return }
    setLoading(true)
    setError('')
    try {
      let logo_url = form.logo_url

      if (file) {
        const compressed = await compressImage(file)
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.webp`
        const { error: uploadError } = await supabase.storage
          .from('competition')
          .upload(fileName, compressed, { contentType: 'image/webp' })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('competition').getPublicUrl(fileName)
        logo_url = `${data.publicUrl}?t=${Date.now()}`
      }

      const payload = {
        name:            form.name.trim(),
        type:            form.type,
        legs:            parseInt(form.legs),
        num_groups:      form.type === 'champions' ? parseInt(form.num_groups) : null,
        num_divisions:   form.type === 'league' ? parseInt(form.num_divisions) : 1,
        promotion_count: form.type === 'league' && form.num_divisions > 1 ? parseInt(form.promotion_count) : 0,
        relegation_count: form.type === 'league' && form.num_divisions > 1 ? parseInt(form.relegation_count) : 0,
        season_group:    form.season_group.trim() || null,
        final_series_type: (form.type === 'cup' || form.type === 'champions') ? form.final_series_type : 'single',
        final_best_of:   (form.type === 'cup' || form.type === 'champions') ? parseInt(form.final_best_of) : 1,
        logo_url:        logo_url || null,
      }
      if (isEdit) {
        const { error: err } = await supabase.from('seasons').update({
          ...payload,
          status: form.status,
        }).eq('id', season.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('seasons').insert({
          ...payload,
          start_date: new Date().toISOString().slice(0, 10),
          created_by: user.id,
          status:     'active',
        })
        if (err) throw err
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-md animate-slide-in overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg flex items-center gap-2" style={{color:'#0f172a'}}>
            <Trophy size={18} className="text-brand-600" />
            {isEdit ? 'Edit Kompetisi' : 'Buat Kompetisi'}
          </h2>
          <button type="button" onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
            style={{color:'#94a3b8'}}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <p className="text-accent-red text-xs mb-4 rounded-lg p-3" style={{backgroundColor:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)'}}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-24 h-24 rounded-2xl bg-brand-50 border-2 border-dashed border-brand-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-brand-500 transition-colors"
              onClick={() => fileRef.current.click()}
            >
              {preview
                ? <img src={preview} alt="logo kompetisi" className="w-full h-full object-cover" />
                : <Trophy size={40} className="text-brand-300" />}
            </div>
            <button type="button" onClick={() => fileRef.current.click()} className="text-xs text-ink-faint hover:text-ink-muted transition-colors">
              {preview ? 'Ganti logo' : 'Upload logo kompetisi'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{color:'#64748b'}}>Nama Kompetisi</label>
            <input required value={form.name} onChange={update('name')} className="input" placeholder="Liga Musim 1" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{color:'#64748b'}}>
              Musim <span className="text-xs font-normal" style={{color:'#94a3b8'}}>(opsional — untuk pengelompokan)</span>
            </label>
            <input
              value={form.season_group}
              onChange={update('season_group')}
              className="input"
              placeholder="cth: Musim 1, 2024/2025"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{color:'#64748b'}}>Tipe</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'league',    label: 'Liga',      desc: 'Round-robin' },
                { key: 'cup',       label: 'Cup',       desc: 'Knockout' },
                { key: 'champions', label: 'Champions', desc: 'Grup + KO' },
              ].map(t => (
                <button key={t.key} type="button"
                  onClick={() => setForm(p => ({ ...p, type: t.key }))}
                  className="rounded-xl p-3 text-left transition-all"
                  style={form.type === t.key
                    ? {border:'1px solid #2563eb', backgroundColor:'#eff6ff', color:'#1d4ed8'}
                    : {border:'1px solid #e2e8f0', backgroundColor:'#f8fafc', color:'#64748b'}
                  }
                >
                  <div className="font-display font-semibold text-sm">{t.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {form.type === 'league' && (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{color:'#64748b'}}>Putaran</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(n => (
                    <button key={n} type="button"
                      onClick={() => setForm(p => ({ ...p, legs: n }))}
                      className="rounded-xl p-3 text-center transition-all"
                      style={parseInt(form.legs) === n
                        ? {border:'1px solid #2563eb', backgroundColor:'#eff6ff', color:'#1d4ed8'}
                        : {border:'1px solid #e2e8f0', backgroundColor:'#f8fafc', color:'#64748b'}
                      }
                    >
                      <div className="font-display font-semibold text-sm">{n} Putaran</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{color:'#64748b'}}>
                  Jumlah Divisi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(n => (
                    <button key={n} type="button"
                      onClick={() => setNumDivisions(n)}
                      className="rounded-xl p-3 text-center transition-all"
                      style={parseInt(form.num_divisions) === n
                        ? {border:'1px solid #2563eb', backgroundColor:'#eff6ff', color:'#1d4ed8'}
                        : {border:'1px solid #e2e8f0', backgroundColor:'#f8fafc', color:'#64748b'}
                      }
                    >
                      <div className="font-display font-semibold text-sm">{n} Divisi</div>
                      {n === 1 && <div className="text-xs mt-0.5 opacity-70">Tanpa degradasi</div>}
                      {n > 1 && <div className="text-xs mt-0.5 opacity-70">Ada degradasi/promosi</div>}
                    </button>
                  ))}
                </div>
              </div>

              {form.num_divisions > 1 && (
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl" style={{backgroundColor:'#f8fafc', border:'1px solid #e2e8f0'}}>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{color:'#64748b'}}>
                      Degradasi <span className="text-accent-red">⬇</span>
                    </label>
                    <p className="text-[10px] text-slate-400 mb-1.5">Terbawah divisi atas</p>
                    <select
                      value={form.relegation_count}
                      onChange={e => setForm(p => ({ ...p, relegation_count: parseInt(e.target.value) }))}
                      className="input text-sm"
                    >
                      {[0, 1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n} tim</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{color:'#64748b'}}>
                      Promosi <span className="text-accent-green">⬆</span>
                    </label>
                    <p className="text-[10px] text-slate-400 mb-1.5">Teratas divisi bawah</p>
                    <select
                      value={form.promotion_count}
                      onChange={e => setForm(p => ({ ...p, promotion_count: parseInt(e.target.value) }))}
                      className="input text-sm"
                    >
                      {[0, 1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n} tim</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {form.type === 'champions' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{color:'#64748b'}}>Jumlah Grup</label>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 6, 8].map(n => (
                  <button key={n} type="button"
                    onClick={() => setForm(p => ({ ...p, num_groups: n }))}
                    className="rounded-xl p-3 text-center transition-all"
                    style={parseInt(form.num_groups) === n
                      ? {border:'1px solid #2563eb', backgroundColor:'#eff6ff', color:'#1d4ed8'}
                      : {border:'1px solid #e2e8f0', backgroundColor:'#f8fafc', color:'#64748b'}
                    }
                  >
                    <div className="font-display font-semibold text-sm">{n}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(form.type === 'cup' || form.type === 'champions') && (
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{color:'#64748b'}}>Format Final</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { key: 'single', label: 'Single Match', desc: '1 pertandingan' },
                  { key: 'best_of', label: 'Best of X', desc: 'Seri pertandingan' },
                ].map(t => (
                  <button key={t.key} type="button"
                    onClick={() => setForm(p => ({ ...p, final_series_type: t.key }))}
                    className="rounded-xl p-3 text-left transition-all"
                    style={form.final_series_type === t.key
                      ? {border:'1px solid #2563eb', backgroundColor:'#eff6ff', color:'#1d4ed8'}
                      : {border:'1px solid #e2e8f0', backgroundColor:'#f8fafc', color:'#64748b'}
                    }
                  >
                    <div className="font-display font-semibold text-sm">{t.label}</div>
                    <div className="text-xs mt-0.5 opacity-70">{t.desc}</div>
                  </button>
                ))}
              </div>
              
              {form.final_series_type === 'best_of' && (
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{color:'#64748b'}}>Jumlah Pertandingan di Final</label>
                  <div className="grid grid-cols-5 gap-2 mb-2">
                    {[3, 5, 7, 9].map(n => (
                      <button key={n} type="button"
                        onClick={() => setForm(p => ({ ...p, final_best_of: n }))}
                        className="rounded-xl p-2 text-center transition-all"
                        style={parseInt(form.final_best_of) === n
                          ? {border:'1px solid #2563eb', backgroundColor:'#eff6ff', color:'#1d4ed8'}
                          : {border:'1px solid #e2e8f0', backgroundColor:'#f8fafc', color:'#64748b'}
                        }
                      >
                        <div className="font-display font-semibold text-sm">Bo{n}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs" style={{color:'#94a3b8'}}>Custom:</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={form.final_best_of} 
                      onChange={update('final_best_of')}
                      className="input text-sm w-20"
                    />
                    <span className="text-xs" style={{color:'#64748b'}}>pertandingan</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Batal</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm">
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Buat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}