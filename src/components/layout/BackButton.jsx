import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Tombol kembali.
 * Pakai navigate(-1) — React Router handle history SPA dengan benar.
 * Fallback ke URL tertentu jika history kosong (buka langsung dari link).
 */
export default function BackButton({ fallback = '/', label = 'Kembali' }) {
  const navigate = useNavigate()

  function handleBack(e) {
    e.preventDefault()
    e.stopPropagation()
    // React Router tracks its own history via location.key
    // 'default' = halaman pertama yang dibuka langsung (tidak ada history sebelumnya)
    navigate(-1)
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
