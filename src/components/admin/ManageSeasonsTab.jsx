import { useState } from 'react'
import { Trophy, Plus, XCircle, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import SeasonFormModal from './SeasonFormModal'

export default function ManageSeasonsTab({ seasons, allTeams, onUpdate }) {
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [seasonTeams,    setSeasonTeams]    = useState([])
  const [addTeamId,      setAddTeamId]      = useState('')
  const [formSeason,     setFormSeason]     = useState(null)

  async function loadSeasonTeams(seasonId) {
    setSelectedSeason(seasonId)
    const { data } = await supabase.from('season_teams')
      .select('*, team:teams(name)').eq('season_id', seasonId)
    setSeasonTeams(data || [])
  }

  async function addTeamToSeason() {
    if (!addTeamId || !selectedSeason) return
    await supabase.from('season_teams').insert({ season_id: selectedSeason, team_id: addTeamId })
    setAddTeamId('')
    loadSeasonTeams(selectedSeason)
  }

  async function removeTeamFromSeason(stId) {
    await supabase.from('season_teams').delete().eq('id', stId)
    loadSeasonTeams(selectedSeason)
  }

  async function handleDeleteSeason(s) {
    if (!window.confirm(`Hapus kompetisi "${s.name}"? Jadwal dan data terkait ikut terhapus.`)) return
    const { error } = await supabase.from('seasons').delete().eq('id', s.id)
    if (error) { alert(error.message); return }
    if (selectedSeason === s.id) { setSelectedSeason(null); setSeasonTeams([]) }
    onUpdate()
  }

  const enrolledIds = seasonTeams.map(st => st.team_id)
  const available   = allTeams.filter(t => !enrolledIds.includes(t.id))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Season list */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-2" style={{borderBottom:'1px solid #e2e8f0'}}>
          <span className="font-display font-semibold text-sm" style={{color:'#0f172a'}}>Kompetisi</span>
        </div>
        <div className="divide-y max-h-[480px] overflow-y-auto" style={{borderColor:'#e2e8f0'}}>
          {seasons.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{color:'#94a3b8'}}>Belum ada kompetisi</div>
          ) : seasons.map(s => (
            <div
              key={s.id}
              className="flex items-stretch gap-1"
              style={selectedSeason === s.id ? {backgroundColor:'#eff6ff'} : {}}
            >
              <button
                type="button"
                onClick={() => loadSeasonTeams(s.id)}
                className="flex-1 text-left flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 min-w-0"
              >
                <Trophy size={14} className="shrink-0 text-brand-500" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{color:'#0f172a'}}>{s.name}</div>
                  <div className="text-xs capitalize" style={{color:'#94a3b8'}}>{s.type}</div>
                </div>
              </button>
              <div className="flex items-center gap-0.5 pr-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setFormSeason(s)}
                  className="p-2 rounded-lg transition-colors hover:bg-brand-50 hover:text-brand-600"
                  style={{color:'#94a3b8'}}
                  title="Edit"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSeason(s)}
                  className="p-2 rounded-lg transition-colors hover:bg-red-50 hover:text-accent-red"
                  style={{color:'#94a3b8'}}
                  title="Hapus"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team management */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedSeason ? (
          <div className="card p-10 text-center text-sm" style={{color:'#94a3b8'}}>
            Pilih kompetisi di kiri untuk kelola tim peserta
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{borderBottom:'1px solid #e2e8f0'}}>
              <span className="font-display font-semibold text-sm" style={{color:'#0f172a'}}>
                Tim terdaftar ({seasonTeams.length})
              </span>
            </div>
            <div className="px-5 py-3 flex gap-3" style={{borderBottom:'1px solid #e2e8f0'}}>
              <select value={addTeamId} onChange={e => setAddTeamId(e.target.value)} className="input text-sm flex-1">
                <option value="">Pilih tim untuk ditambahkan...</option>
                {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button type="button" onClick={addTeamToSeason} disabled={!addTeamId} className="btn-primary text-sm px-4 flex items-center gap-1">
                <Plus size={14} /> Tambah
              </button>
            </div>
            <div className="divide-y" style={{borderColor:'#e2e8f0'}}>
              {seasonTeams.map(st => (
                <div key={st.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="w-7 h-7 rounded bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
                    {st.team?.name?.[0]}
                  </div>
                  <span className="flex-1 text-sm font-medium" style={{color:'#0f172a'}}>{st.team?.name}</span>
                  <button
                    type="button"
                    onClick={() => removeTeamFromSeason(st.id)}
                    className="transition-colors hover:text-accent-red"
                    style={{color:'#94a3b8'}}
                  >
                    <XCircle size={15} />
                  </button>
                </div>
              ))}
              {seasonTeams.length === 0 && (
                <div className="px-5 py-6 text-center text-sm" style={{color:'#94a3b8'}}>Belum ada tim terdaftar</div>
              )}
            </div>
          </div>
        )}
      </div>

      {formSeason && (
        <SeasonFormModal
          season={formSeason === 'new' ? null : formSeason}
          onClose={() => setFormSeason(null)}
          onSaved={() => { setFormSeason(null); onUpdate() }}
        />
      )}
    </div>
  )
}
