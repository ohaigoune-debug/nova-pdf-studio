/**
 * «فضاء العرض» لصفحة مدوّرة (/Rotate): الإحداثيات كما يراها المستخدم على الشاشة (نفس نظام pdf.js viewport)،
 * مقابل فضاء المستخدم في ملف PDF (الصفحة غير المدوّرة، الأصل أسفل-يسار).
 *
 * المصفوفة تحوّل نقطة (X, Y) في «فضاء العرض بنظام PDF» — الأصل أسفل-يسار الصفحة كما تُعرض، y للأعلى —
 * إلى فضاء المستخدم (px, py): px = a·X + c·Y + e ، py = b·X + d·Y + f.
 * الدوران في PDF باتجاه عقارب الساعة عند العرض.
 */
export type Matrix = [number, number, number, number, number, number]
export type QuarterTurn = 0 | 90 | 180 | 270

export function normalizeRotation(angle: number): QuarterTurn {
  const r = (((Math.round(angle / 90) * 90) % 360) + 360) % 360
  return r as QuarterTurn
}

/** مقاس الصفحة كما تُعرض (يتبادل العرض والارتفاع عند 90/270). */
export function displaySize(rotation: QuarterTurn, width: number, height: number): { width: number; height: number } {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height }
}

export function displayToUserMatrix(rotation: QuarterTurn, width: number, height: number): Matrix {
  switch (rotation) {
    case 90:
      return [0, 1, -1, 0, width, 0]
    case 180:
      return [-1, 0, 0, -1, width, height]
    case 270:
      return [0, -1, 1, 0, 0, height]
    default:
      return [1, 0, 0, 1, 0, 0]
  }
}

export function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}
