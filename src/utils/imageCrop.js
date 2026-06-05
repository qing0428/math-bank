/**
 * Image Cropping Utility
 *
 * Crops individual question regions from a full exam page image
 * based on bounding box coordinates returned by the vision LLM.
 */

/**
 * Crop a region from an image.
 *
 * @param {string} imageDataUrl - Source image as data URL
 * @param {Object} bbox - Bounding box { x, y, w, h } in 0.0~1.0 (percentage of image dimensions)
 * @param {number} padding - Padding around the crop in pixels (default 10)
 * @returns {Promise<string>} Cropped image as data URL (JPEG)
 */
export function cropImage(imageDataUrl, bbox, padding = 10) {
  return new Promise((resolve, reject) => {
    if (!bbox || typeof bbox.x !== 'number') {
      resolve(imageDataUrl) // fallback to original
      return
    }

    const img = new Image()
    img.onload = () => {
      try {
        const { naturalWidth: imgW, naturalHeight: imgH } = img

        // Convert percentage to pixels with padding
        let x = Math.max(0, Math.round(bbox.x * imgW) - padding)
        let y = Math.max(0, Math.round(bbox.y * imgH) - padding)
        let w = Math.min(imgW - x, Math.round(bbox.w * imgW) + padding * 2)
        let h = Math.min(imgH - y, Math.round(bbox.h * imgH) + padding * 2)

        // Clamp to image bounds
        if (x + w > imgW) w = imgW - x
        if (y + h > imgH) h = imgH - y
        if (w <= 0 || h <= 0) {
          resolve(imageDataUrl)
          return
        }

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')

        // White background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)

        // Draw cropped region
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h)

        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch (err) {
        console.warn('Crop failed:', err.message)
        resolve(imageDataUrl)
      }
    }
    img.onerror = () => resolve(imageDataUrl)
    img.src = imageDataUrl
  })
}

/**
 * Batch crop multiple questions from a single source image.
 *
 * @param {string} imageDataUrl - Source image as data URL
 * @param {Array} questions - Array of question objects with bbox field
 * @returns {Promise<Array>} Same questions with cropped imageUrl
 */
export async function batchCropQuestions(imageDataUrl, questions) {
  const results = []
  for (const q of questions) {
    if (q.bbox) {
      const croppedUrl = await cropImage(imageDataUrl, q.bbox)
      results.push({ ...q, imageUrl: croppedUrl })
    } else {
      results.push(q)
    }
  }
  return results
}
