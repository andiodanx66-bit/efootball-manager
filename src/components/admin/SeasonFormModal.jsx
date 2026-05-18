import { useState, useEffect } from 'react'
import { Trophy, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function SeasonFormModal({ season, onClose, onSaved }) {
  const { user, isAdmin } = useAuth()
  const [form,    setForm]    = useState({ name: '', type: 'league', legs: 1, num_groups: 4 })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const isEdit = Boolean(season?.id)

  useEffect(() => {
    if (season) {
      setForm({
        name:       season.name       || '',
        type:       season.type       || 'league',
        legs:       season.legs       || 1,
        num_groups: season.num_groups || 4,
        status:     season.status     || 'active',
      })
    } else {
      setForm({ name: '', type: 'league', legs: 1, num_groups: 4 })
    }
    setError('')
  }, [season])

  function update(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isAdmin) { setError('Hanya admin yang dapat mengubah kompetisi.'); return }
    setLoading(true)
    setError('')
    try {
      if (isEdit) {
        const { error: err } = await supabase.from('seasons').update({
          name:       form.name.trim(),
          type:       form.type,
          legs:       parseInt(form.legs),
          num_groups: form.type === 'champions' ? parseInt(form.num_groups) : null,
          status:     form.status,
        }).eq('id', season.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('seasons').insert({
          name:       form.name.trim(),
          type:       form.type,
          legs:       parseInt(form.legs),
          num_groups: form.type === 'champions' ? parseInt(form.num_groups) : null,
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
      <div className="card p-6 w-full max-w-md animate-slide-in" onClick={e => e.stopPropagation()}>
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
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{color:'#64748b'}}>Nama Kompetisi</label>
            <input required value={form.name} onChange={update('name')} className="input" placeholder="Liga Musim 1" />
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
