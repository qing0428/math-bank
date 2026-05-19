import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Image cropper overlay. User draws a selection rectangle on the image,
 * then confirms to crop. Returns the cropped image as a data URL.
 */
export default function ImageCropper({ imageUrl, onCropComplete, onCancel }) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [selection, setSelection] = useState(null) // { x, y, w, h }
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(null) // 'nw' | 'ne' | 'sw' | 'se' | null
  const [moving, setMoving] = useState(false)
  const startRef = useRef({ x: 0, y: 0, sel: null })
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 })

  const updateImageBounds = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return
    const img = imgRef.current
    const container = containerRef.current
    const rect = img.getBoundingClientRect()
    const contRect = container.getBoundingClientRect()
    setImgSize({ w: rect.width, h: rect.height })
    setImgOffset({ x: rect.left - contRect.left, y: rect.top - contRect.top })
  }, [])

  useEffect(() => {
    updateImageBounds()
    window.addEventListener('resize', updateImageBounds)
    return () => window.removeEventListener('resize', updateImageBounds)
  }, [updateImageBounds, imageUrl])

  const getRelPos = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left - imgOffset.x,
      y: e.clientY - rect.top - imgOffset.y,
    }
  }

  const clampToImage = (x, y, w, h) => {
    x = Math.max(0, Math.min(x, imgSize.w))
    y = Math.max(0, Math.min(y, imgSize.h))
    w = Math.max(10, Math.min(w, imgSize.w - x))
    h = Math.max(10, Math.min(h, imgSize.h - y))
    return { x, y, w, h }
  }

  // Start drawing a new selection
  const handleMouseDown = (e) => {
    if (resizing || moving) return
    const pos = getRelPos(e)
    if (pos.x < 0 || pos.y < 0 || pos.x > imgSize.w || pos.y > imgSize.h) return
    setDragging(true)
    startRef.current = { x: pos.x, y: pos.y }
    setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 })
  }

  const handleMouseMove = (e) => {
    if (dragging) {
      const pos = getRelPos(e)
      const sx = startRef.current.x
      const sy = startRef.current.y
      const rawSel = {
        x: Math.min(sx, pos.x),
        y: Math.min(sy, pos.y),
        w: Math.abs(pos.x - sx),
        h: Math.abs(pos.y - sy),
      }
      setSelection(clampToImage(rawSel.x, rawSel.y, rawSel.w, rawSel.h))
    } else if (resizing && selection) {
      const pos = getRelPos(e)
      const s = startRef.current
      let { x, y, w, h } = s.sel

      if (resizing.includes('e')) {
        w = Math.max(10, pos.x - x)
      }
      if (resizing.includes('w')) {
        const newW = Math.max(10, s.sel.x + s.sel.w - pos.x)
        x = s.sel.x + s.sel.w - newW
        w = newW
      }
      if (resizing.includes('s')) {
        h = Math.max(10, pos.y - y)
      }
      if (resizing.includes('n')) {
        const newH = Math.max(10, s.sel.y + s.sel.h - pos.y)
        y = s.sel.y + s.sel.h - newH
        h = newH
      }
      setSelection(clampToImage(x, y, w, h))
    } else if (moving && selection) {
      const pos = getRelPos(e)
      const dx = pos.x - startRef.current.x
      const dy = pos.y - startRef.current.y
      setSelection(clampToImage(
        startRef.current.sel.x + dx,
        startRef.current.sel.y + dy,
        startRef.current.sel.w,
        startRef.current.sel.h,
      ))
    }
  }

  const handleMouseUp = () => {
    setDragging(false)
    setResizing(null)
    setMoving(false)
  }

  const startResize = (corner, e) => {
    e.stopPropagation()
    setResizing(corner)
    startRef.current = { ...getRelPos(e), sel: { ...selection } }
  }

  const startMove = (e) => {
    e.stopPropagation()
    setMoving(true)
    startRef.current = { ...getRelPos(e), sel: { ...selection } }
  }

  const handleConfirm = () => {
    if (!selection || selection.w < 5 || selection.h < 5) return
    if (!imgRef.current) return

    const img = imgRef.current
    const scaleX = img.naturalWidth / imgSize.w
    const scaleY = img.naturalHeight / imgSize.h

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(selection.w * scaleX)
    canvas.height = Math.round(selection.h * scaleY)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(
      img,
      Math.round(selection.x * scaleX),
      Math.round(selection.y * scaleY),
      canvas.width,
      canvas.height,
      0, 0,
      canvas.width,
      canvas.height,
    )
    onCropComplete?.(canvas.toDataURL('image/png'))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">裁剪图片</h3>
          <p className="text-xs text-gray-400">拖拽选择区域，四角可调整大小</p>
        </div>

        {/* Crop area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-4 flex items-center justify-center relative select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: dragging ? 'crosshair' : 'default' }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="待裁剪图片"
            onLoad={updateImageBounds}
            className="max-w-full max-h-[60vh] block"
            draggable={false}
          />

          {/* Selection overlay */}
          {selection && selection.w > 2 && selection.h > 2 && (
            <>
              {/* Dark overlay outside selection */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: imgOffset.x,
                  top: imgOffset.y,
                  width: imgSize.w,
                  height: imgSize.h,
                  background: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5))`,
                  mask: `linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,
                  WebkitMask: `linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,
                  maskComposite: 'exclude',
                  WebkitMaskComposite: 'xor',
                  padding: `${selection.y}px ${imgSize.w - selection.x - selection.w}px ${imgSize.h - selection.y - selection.h}px ${selection.x}px`,
                }}
              />

              {/* Selection box */}
              <div
                className="absolute border-2 border-white shadow-lg cursor-move"
                style={{
                  left: imgOffset.x + selection.x,
                  top: imgOffset.y + selection.y,
                  width: selection.w,
                  height: selection.h,
                }}
                onMouseDown={startMove}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/40" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/40" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/40" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/40" />
                </div>

                {/* Corner handles */}
                {['nw', 'ne', 'sw', 'se'].map(corner => (
                  <div
                    key={corner}
                    className="absolute w-3 h-3 bg-white border border-primary-500 rounded-sm"
                    style={{
                      cursor: `${corner}-resize`,
                      ...(corner.includes('n') ? { top: -6 } : { bottom: -6 }),
                      ...(corner.includes('w') ? { left: -6 } : { right: -6 }),
                    }}
                    onMouseDown={(e) => startResize(corner, e)}
                  />
                ))}

                {/* Size label */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                  {Math.round(selection.w)} × {Math.round(selection.h)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selection || selection.w < 10 || selection.h < 10}
            className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            确认裁剪
          </button>
        </div>
      </div>
    </div>
  )
}
