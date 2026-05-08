// Helper chèn transformation vào URL Cloudinary để giảm size ảnh tải về.
// Cloudinary URL có dạng: https://res.cloudinary.com/<cloud>/image/upload/<version>/<path>
// Insert "<transform>/" ngay sau "/upload/" để áp transform.
// URL non-Cloudinary trả về nguyên — không phá link avatar Google / ảnh bên ngoài.

const CLOUDINARY_HOST = "res.cloudinary.com";

/**
 * @param {string} url
 * @param {{ width?: number, quality?: string|number }} [opts]
 * @returns {string}
 */
export function optimizeImage(url, opts = {}) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes(CLOUDINARY_HOST)) return url;
  // Đã có transform sẵn (vd "/upload/w_500/...") → không chèn thêm để tránh
  // double-transform sai kết quả.
  if (/\/upload\/[^/]*[a-z]_[^/]+/.test(url)) return url;

  const { width = 800, quality = "auto" } = opts;
  // c_limit: chỉ thu nhỏ nếu ảnh gốc lớn hơn width — không upscale (giữ chất lượng).
  // f_auto: Cloudinary tự chọn format tốt nhất (WebP / AVIF) cho browser.
  const transform = `f_auto,q_${quality},w_${width},c_limit`;
  return url.replace("/upload/", `/upload/${transform}/`);
}
