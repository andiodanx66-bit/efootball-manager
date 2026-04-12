import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function TeamFormModal({ isOpen, team, onClose, onSave }) {
  const [formData, setFormData] = useState({ name: '', logo_url: '', status: 'pending' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        logo_url: team.logo_url || '',
        status: team.status || 'pending'
      })
    } else {
      setFormData({ name: '', logo_url: '', status: 'pending' })
    }
    setError('')
  }, [team, isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!formData.name.trim()) {
      setError('Nama tim harus diisi')
      setLoading(false)
      return
    }

    try {
      if (team?.id) {
        // Update existing team
        const { error: err } = await supabase.from('teams')
          .update({
            name: formData.name.trim(),
            logo_url: formData.logo_url.trim() || null,
            status: formData.status
          })
          .eq('id', team.id)

        if (err) throw err
      } else {
        // Pemain membuat tim dari halaman Tim Saya; admin tidak menambah tim lewat sini.
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-pitch-dark rounded-2xl max-w-md w-full p-6 border border-white/10 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-bold">
            {team ? 'Edit Tim' : 'Tambah Tim Baru'}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Nama Tim *</label>
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
            <label className="block text-sm font-medium mb-2 text-white/70">URL Logo</label>
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
            <label className="block text-sm font-medium mb-2 text-white/70">Status</label>
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
            <div className="bg-accent-red/20 border border-accent-red/50 text-accent-red text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-white/70 hover:text-white transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary py-2 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : (team ? 'Update' : 'Tambah')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
