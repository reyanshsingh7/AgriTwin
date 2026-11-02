import { useState } from 'react'
import { IMAGES } from '../lib.js'

/* Logo mark: a wheat ear in a circle (inline SVG, same as public/logo.svg). */
export function LogoMark({ size = 36 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#2f5d3a" />
      <path d="M20 33V12" stroke="#f6f1e7" strokeWidth="2" strokeLinecap="round" />
      <g fill="#f6f1e7">
        <ellipse cx="20" cy="8.5" rx="2.1" ry="3.6" />
        <ellipse cx="15.6" cy="14" rx="2" ry="3.4" transform="rotate(-32 15.6 14)" />
        <ellipse cx="24.4" cy="14" rx="2" ry="3.4" transform="rotate(32 24.4 14)" />
        <ellipse cx="15.6" cy="20.5" rx="2" ry="3.4" transform="rotate(-32 15.6 20.5)" />
        <ellipse cx="24.4" cy="20.5" rx="2" ry="3.4" transform="rotate(32 24.4 20.5)" />
      </g>
    </svg>
  )
}

/* A photo that quietly disappears if the file has not been added yet. */
export function OptionalPhoto({ src, alt, className = '', onMissing }) {
  const [gone, setGone] = useState(false)
  if (gone) return null
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => { setGone(true); onMissing?.() }}
    />
  )
}

/* Crop thumbnail: real photo from /images/crops/<name>.jpg, else a plain tile with the first letter. */
export function CropThumb({ crop, label, size = 44 }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }
  if (failed) {
    return <span className="crop-thumb tile" style={style} aria-hidden="true">{String(label || crop).charAt(0)}</span>
  }
  return (
    <img className="crop-thumb" style={style} src={IMAGES.crop(crop)} alt="" onError={() => setFailed(true)} />
  )
}
