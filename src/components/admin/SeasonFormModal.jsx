import { useState, useEffect } from 'react'
import { Trophy, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function SeasonFormModal({ season, onClose, onSaved }) {
  const { user, isAdmin } = useAuth()
  const [form, setForm] = useState({ name: '', type: 'league', legs: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = Boolean(season?.id)

  useEffect(() => {
    if (season) {
      setForm({
        name: season.name || '',
        type: season.type || 'league',
        legs: season.legs || 1,
        status: season.status || 'active'
      })
    } else {
      setForm({ name: '', type: 'league', legs: 1 })
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
          name: form.name.trim(),
          type: form.type,
          legs: parseInt(form.legs),
          status: form.status
        }).eq('id', season.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('seasons').insert({
          name: form.name.trim(),
          type: form.type,
          legs: parseInt(form.legs),
          start_date: new Date().toISOString().slice(0, 10),
          created_by: user.id,
          status: 'active'
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-md animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Trophy size={18} className="text-brand-400" /> {isEdit ? 'Edit kompetisi' : 'Buat kompetisi'}
          </h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        {error && <p className="text-accent-red text-xs mb-4 bg-accent-red/10 p-3 rounded-lg">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1.5 block">Nama Kompetisi</label>
            <input required value={form.name} onChange={update('name')} className="input" placeholder="Liga Musim 1" />
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1.5 block">Tipe</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'league',    label: 'Liga',      desc: 'Round-robin' },
                { key: 'cup',       label: 'Cup',       desc: 'Knockout' },
                { key: 'champions', label: 'Champions', desc: 'Grup + KO' },
              ].map(t => (
                <button key={t.key} type="button" onClick={() => setForm(p => ({ ...p, type: t.key }))}
                  className={`rounded-xl p-3 text-left border transition-all ${form.type === t.key ? 'border-brand-500 bg-brand-600/20 text-white' : 'border-white/10 text-white/50 hover:border-white/30'}`}>
                  <div className="font-display font-semibold text-sm">{t.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {form.type === 'league' && (
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Putaran</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(n => (
                  <button key={n} type="button" onClick={() => setForm(p => ({ ...p, legs: n }))}
                    className={`rounded-xl p-3 text-center border transition-all ${parseInt(form.legs) === n ? 'border-brand-500 bg-brand-600/20 text-white' : 'border-white/10 text-white/50 hover:border-white/30'}`}>
                    <div className="font-display font-semibold text-sm">{n} Putaran</div>
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
