import { useEffect, useState, useMemo } from 'react'
import { Trash2, Search, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function MatchHistoryTab() {
  const [history,      setHistory]      = useState([])
  const [seasons,      setSeasons]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState(new Set())
  const [search,       setSearch]       = useState('')
  const [filterSeason, setFilterSeason] = useState('all')
  const [deleting,     setDeleting]     = useState(false)
  const [confirmOpen,  setConfirmOpen]  = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: h }, { data: s }] = await Promise.all([
      supabase
        .from('match_history')
        .select('*')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('approved_at', { ascending: false }),
      supabase
        .from('seasons')
        .select('id, name')
        .order('created_at', { ascending: false })
    ])
    setHistory(h || [])
    setSeasons(s || [])
    setSelected(new Set())
    setLoading(false)
  }

  const displayed = useMemo(() => {
    return history.filter(m => {
      const matchesSeason = filterSeason === 'all' || m.season_id === filterSeason
      const q = search.toLowerCase()
      const matchesSearch = !q ||
        m.home_team_name?.toLowerCase().includes(q) ||
        m.away_team_name?.toLowerCase().includes(q) ||
        m.season_name?.toLowerCase().includes(q)
      return matchesSeason && matchesSearch
    })
  }, [history, filterSeason, search])

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === displayed.length && displayed.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(displayed.map(m => m.id)))
    }
  }

  const allChecked  = displayed.length > 0 && selected.size === displayed.length
  const someChecked = selected.size > 0 && selected.size < displayed.length

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('match_history').delete().in('id', [...selected])
    setConfirmOpen(false)
    setDeleting(false)
    fetchAll()
  }

  function formatDate(ts) {
    if (!ts) return '-'
    return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const seasonBadgeClass = (type) =>
    type === 'champions' ? 'badge-purple' : type === 'cup' ? 'badge-yellow' : 'badge-blue'

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display font-semibold text-base" style={{ color: '#0f172a' }}>
          Riwayat Pertandingan ({history.length})
        </h2>
        {selected.size > 0 && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5 text-xs btn-danger py-1.5 px-3"
          >
            <Trash2 size={13} /> Hapus {selected.size} data
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm w-full"
            placeholder="Cari tim atau kompetisi..."
          />
        </div>
        <select
          value={filterSeason}
          onChange={e => setFilterSeason(e.target.value)}
          className="input text-sm sm:w-48"
        >
          <option value="all">Semua Kompetisi</option>
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Select-all bar — muncul kalau ada data */}
      {!loading && displayed.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
          style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
        >
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked }}
            onChange={toggleAll}
            className="w-4 h-4 rounded cursor-pointer accent-brand-600"
          />
          <span className="text-xs" style={{ color: '#64748b' }}>
            {selected.size === 0
              ? `Pilih semua (${displayed.length})`
              : `${selected.size} dari ${displayed.length} dipilih`}
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card p-10 text-center text-sm" style={{ color: '#94a3b8' }}>
          Tidak ada data riwayat pertandingan
        </div>
      ) : (
        <>
          {/* ── MOBILE: card list (< md) ── */}
          <div className="md:hidden space-y-2">
            {displayed.map(m => {
              const isSelected = selected.has(m.id)
              return (
                <div
                  key={m.id}
                  onClick={() => toggleOne(m.id)}
                  className="card px-4 py-3 cursor-pointer transition-colors"
                  style={{ backgroundColor: isSelected ? '#eff6ff' : undefined, borderColor: isSelected ? '#bfdbfe' : undefined }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(m.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded cursor-pointer accent-brand-600 mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Kompetisi + Tanggal */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`badge ${seasonBadgeClass(m.season_type)}`}>
                          {m.season_name || '-'}
                        </span>
                        <span className="text-xs shrink-0" style={{ color: '#94a3b8' }}>
                          {formatDate(m.approved_at)}
                        </span>
                      </div>
                      {/* Skor baris */}
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-right text-sm font-medium truncate" style={{ color: '#0f172a' }}>
                          {m.home_team_name}
                        </span>
                        <span
                          className="font-display font-bold text-sm rounded-lg px-2.5 py-0.5 border shrink-0"
                          style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#0f172a' }}
                        >
                          {m.home_score}–{m.away_score}
                        </span>
                        <span className="flex-1 text-left text-sm font-medium truncate" style={{ color: '#0f172a' }}>
                          {m.away_team_name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── DESKTOP: tabel (≥ md) ── */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Kompetisi</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Tim Kandang</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase w-20" style={{ color: '#64748b' }}>Skor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Tim Tandang</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#f1f5f9' }}>
                {displayed.map(m => {
                  const isSelected = selected.has(m.id)
                  return (
                    <tr
                      key={m.id}
                      onClick={() => toggleOne(m.id)}
                      className="cursor-pointer transition-colors"
                      style={{ backgroundColor: isSelected ? '#eff6ff' : undefined }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '' }}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(m.id)}
                          className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${seasonBadgeClass(m.season_type)}`}>
                          {m.season_name || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium" style={{ color: '#0f172a' }}>
                        {m.home_team_name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="font-display font-bold text-sm rounded-lg px-2.5 py-1 border"
                          style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#0f172a' }}
                        >
                          {m.home_score}–{m.away_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-left text-sm font-medium" style={{ color: '#0f172a' }}>
                        {m.away_team_name}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#94a3b8' }}>
                        {formatDate(m.approved_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Confirm Delete Modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setConfirmOpen(false)}
        >
          <div
            className="card p-6 w-full max-w-sm space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
              >
                <AlertTriangle size={20} className="text-accent-red" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base" style={{ color: '#0f172a' }}>Hapus Riwayat</h3>
                <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
                  {selected.size} data akan dihapus permanen. Lanjutkan?
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="btn-secondary flex-1 text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger flex-1 text-sm flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} />
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
