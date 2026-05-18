import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Tombol kembali.
 * Navigasi ke fallback path — konsisten tanpa terpengaruh perubahan search params (tab).
 */
export default function BackButton({ fallback = '/', label = 'Kembali' }) {
  const navigate = useNavigate()

  function handleBack(e) {
    e.preventDefault()
    e.stopPropagation()
    navigate(fallback, { replace: true })
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="flex items-center gap-1.5 text-sm font-medium transition-colors mb-4 -ml-1"
      style={{
        color: '#64748b',
        padding: '6px 8px',
        borderRadius: '8px',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <ArrowLeft size={16} />
      <span>{label}</span>
    </button>
  )
}
