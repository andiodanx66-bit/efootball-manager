import { useState, useRef, useEffect } from 'react'
import { Save, Lock, User, Shield, X, Phone, Gamepad2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

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

export default function ProfilePage() {
  const { user, profile, fetchProfile } = useAuth()
  const [username,     setUsername]     = useState(profile?.username || '')
  const [whatsapp,     setWhatsapp]     = useState(profile?.whatsapp || '')
  const [efootballId,  setEfootballId]  = useState(profile?.efootball_id || '')
  const [preview,    setPreview]    = useState(profile?.avatar_url || null)
  const [file,       setFile]       = useState(null)
  const [team,       setTeam]       = useState(null)
  const [teamName,   setTeamName]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState('')
  const [showPwModal, setShowPwModal] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!user?.id) return
    supabase.from('teams').select('*').eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => { setTeam(data); setTeamName(data?.name || '') })
  }, [user?.id])

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')

    let avatar_url = profile?.avatar_url

    if (file) {
      const compressed = await compressImage(file)
      const path = `${user.id}.webp`
      const { error: uploadError } = await supabase.storage
        .from('team-logos')
        .upload(path, compressed, { upsert: true, contentType: 'image/webp' })
      if (uploadError) { setMsg(uploadError.message); setSaving(false); return }
      const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
      avatar_url = `${data.publicUrl}?t=${Date.now()}`
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ username: username.trim(), avatar_url, whatsapp: whatsapp.trim() || null, efootball_id: efootballId.trim() || null })
      .eq('id', user.id)

    if (profileError) { setMsg(profileError.message); setSaving(false); return }

    if (team) {
      const { error: teamError } = await supabase
        .from('teams')
        .update({ name: teamName.trim() })
        .eq('id', team.id)
      if (teamError) { setMsg(teamError.message); setSaving(false); return }
    }

    await fetchProfile(user.id)
    setMsg('Berhasil disimpan.')
    setSaving(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <h1 className="section-title">Profil Saya</h1>

      <div className="card p-6 space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-20 h-20 rounded-full bg-brand-600/20 border-2 border-dashed border-brand-500/40 flex items-center justify-center overflow-hidden cursor-pointer hover:border-brand-400 transition-colors"
            onClick={() => fileRef.current.click()}
          >
            {preview
              ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-2xl font-display font-bold text-brand-400">{profile?.username?.[0]?.toUpperCase() ?? '?'}</span>}
          </div>
          <button type="button" onClick={() => fileRef.current.click()} className="text-xs text-white/40 hover:text-white/70 transition-colors">
            {preview ? 'Ganti foto' : 'Upload foto'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1.5 block flex items-center gap-1.5">
              <User size={13} /> Username
            </label>
            <input value={username} onChange={e => setUsername(e.target.value)} className="input" required />
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1.5 block flex items-center gap-1.5">
              <Phone size={13} /> No. WhatsApp
            </label>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="input" placeholder="628xxxxxxxxxx" />
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1.5 block flex items-center gap-1.5">
              <Gamepad2 size={13} /> ID eFootball
            </label>
            <input value={efootballId} onChange={e => setEfootballId(e.target.value)} className="input" placeholder="ID eFootball kamu" />
          </div>

          {team && (
            <div>
              <label className="text-sm text-white/60 mb-1.5 block flex items-center gap-1.5">
                <Shield size={13} /> Nama Tim
              </label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} className="input" required />
            </div>
          )}

          {msg && <p className={`text-xs ${msg.includes('Berhasil') ? 'text-accent-green' : 'text-accent-red'}`}>{msg}</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
            <Save size={15} /> {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>

        <div className="border-t border-white/10 pt-4">
          <button onClick={() => setShowPwModal(true)} className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
            <Lock size={15} /> Ganti Password
          </button>
        </div>
      </div>

      {showPwModal && <PasswordModal onClose={() => setShowPwModal(false)} />}
    </div>
  )
}

function PasswordModal({ onClose }) {
  const [newPassword, setNewPassword] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [msg,         setMsg]         = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setMsg(error.message)
    else { setMsg('Password berhasil diubah.'); setNewPassword('') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Ganti Password</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1.5 block">Password baru</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input" required minLength={6} placeholder="Minimal 6 karakter" />
          </div>
          {msg && <p className={`text-xs ${msg.includes('berhasil') ? 'text-accent-green' : 'text-accent-red'}`}>{msg}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
