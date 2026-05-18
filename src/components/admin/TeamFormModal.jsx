import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function TeamFormModal({ isOpen, team, onClose, onSave }) {
  const [formData, setFormData] = useState({ name: '', logo_url: '', status: 'pending' })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (team) {
      setFormData({ name: team.name || '', logo_url: team.logo_url || '', status: team.status || 'pending' })
    } else {
      setFormData({ name: '', logo_url: '', status: 'pending' })
    }
    setError('')
  }, [team, isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (!formData.name.trim()) { setError('Nama tim harus diisi'); setLoading(false); return }
    try {
      if (team?.id) {
        const { error: err } = await supabase.from('teams')
          .update({ name: formData.name.trim(), logo_url: formData.logo_url.trim() || null, status: formData.status })
          .eq('id', team.id)
        if (err) throw err
      } else {
        throw new Error('Gunakan menu Tim Saya di akun pemain untuk membuat tim baru.')
      }
      onSave()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-bold" style={{color:'#0f172a'}}>
            {team ? 'Edit Tim' : 'Tambah Tim Baru'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors" style={{color:'#94a3b8'}}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{color:'#64748b'}}>Nama Tim *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Masukkan nama tim"
              className="input w-full"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{color:'#64748b'}}>URL Logo</label>
            <input
              type="url"
              value={formData.logo_url}
              onChange={e => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="input w-full text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{color:'#64748b'}}>Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
              className="input w-full"
              disabled={loading}
            >
              <option value="pending">Menunggu persetujuan</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>

          {error && (
            <div className="text-accent-red text-sm px-3 py-2 rounded-lg" style={{backgroundColor:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)'}}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading} className="btn-secondary flex-1 text-sm">
              Batal
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm">
              {loading ? 'Menyimpan...' : (team ? 'Update' : 'Tambah')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
