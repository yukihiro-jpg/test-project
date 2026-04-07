/**
 * ブラウザ側で画像を圧縮する（Canvas API利用）
 *
 * iPhoneで撮影された画像（3〜5MB）をリサイズしJPEG化して
 * 500KB程度に圧縮する。Vercelの4.5MB body size制限対策。
 */

const MAX_DIMENSION = 1600 // 長辺の最大ピクセル数
const JPEG_QUALITY = 0.82

export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      try {
        // 縦横のうち長い方をMAX_DIMENSIONに合わせる
        let width = img.naturalWidth
        let height = img.naturalHeight

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width)
            width = MAX_DIMENSION
          }
        } else {
          if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height)
            height = MAX_DIMENSION
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('Canvas context が取得できません'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Blob 変換に失敗しました'))
            }
          },
          'image/jpeg',
          JPEG_QUALITY,
        )
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像の読み込みに失敗しました'))
    }

    img.src = url
  })
}
