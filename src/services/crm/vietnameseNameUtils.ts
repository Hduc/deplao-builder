/**
 * Vietnamese Name and Gender Recognition Utilities for Deplao Builder
 */

const FEMALE_NAMES = new Set([
  'thị', 'thu', 'hà', 'hương', 'linh', 'thảo', 'huyền', 'phương', 'trang', 'mai',
  'nhung', 'ngọc', 'yến', 'lan', 'hồng', 'oanh', 'thúy', 'nga', 'hằng', 'liên',
  'hoa', 'dung', 'hạnh', 'loan', 'trinh', 'quỳnh', 'nhi', 'vy', 'mi', 'mỹ',
  'diệp', 'châu', 'ngân', 'thủy', 'tuyết', 'bích', 'vân', 'đan', 'thư', 'uyên',
  'kiều', 'tiên', 'trâm', 'phượng', 'cúc', 'ly', 'nhài', 'sen', 'quyên', 'giang',
  'diệu', 'hiền', 'tâm', 'tú', 'nguyệt', 'bình', 'ánh', 'mơ', 'khuyên', 'thoa'
]);

const MALE_NAMES = new Set([
  'văn', 'đức', 'hữu', 'thành', 'tuấn', 'hoàng', 'quốc', 'minh', 'hùng', 'dũng',
  'thắng', 'trọng', 'huy', 'nam', 'hải', 'long', 'bảo', 'phúc', 'khang', 'khánh',
  'tùng', 'kiên', 'việt', 'tiến', 'sơn', 'khoa', 'thịnh', 'trí', 'nghĩa', 'hiếu',
  'phong', 'tài', 'bách', 'bình', 'quang', 'trung', 'dương', 'luân', 'hoà', 'hòa',
  'cường', 'toàn', 'vinh', 'lâm', 'chí', 'đạt', 'vũ', 'quyết', 'nguyên', 'quân',
  'trực', 'kiệt', 'phú', 'thái', 'bách', 'khôi', 'đăng', 'hào', 'khoát', 'thọ',
  'bằng', 'chấn', 'thống', 'nhật', 'trực', 'lực', 'hợp', 'luận'
]);

export interface PersonalizedVars {
  fullName: string;
  shortName: string;
  honorific: 'anh' | 'chị' | 'anh/chị';
  salutation: string;
  phone: string;
  alias: string;
  gender: 'male' | 'female' | 'other';
}

export function extractShortName(fullName: string): string {
  if (!fullName) return '';
  const clean = fullName.trim();
  if (!clean || clean.startsWith('KH ') || clean.startsWith('Bạn bè ')) {
    return clean;
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts[parts.length - 1];
}

export function detectGender(fullName: string, explicitGender?: string): {
  gender: 'male' | 'female' | 'other';
  honorific: 'anh' | 'chị' | 'anh/chị';
} {
  if (explicitGender) {
    const norm = explicitGender.trim().toLowerCase();
    if (['nam', 'trai', 'male', 'mr', 'anh', 'm'].includes(norm)) {
      return { gender: 'male', honorific: 'anh' };
    }
    if (['nu', 'nữ', 'gai', 'gái', 'female', 'ms', 'mrs', 'chi', 'chị', 'f'].includes(norm)) {
      return { gender: 'female', honorific: 'chị' };
    }
  }

  if (!fullName) {
    return { gender: 'other', honorific: 'anh/chị' };
  }

  const clean = fullName.trim().toLowerCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { gender: 'other', honorific: 'anh/chị' };
  }

  if (parts.includes('thị')) {
    return { gender: 'female', honorific: 'chị' };
  }

  if (parts.includes('văn')) {
    return { gender: 'male', honorific: 'anh' };
  }

  const lastName = parts[parts.length - 1];
  const middleNames = parts.slice(1, -1);

  let femaleScore = 0;
  let maleScore = 0;

  if (FEMALE_NAMES.has(lastName)) femaleScore += 2;
  if (MALE_NAMES.has(lastName)) maleScore += 2;

  for (const mid of middleNames) {
    if (FEMALE_NAMES.has(mid)) femaleScore += 1;
    if (MALE_NAMES.has(mid)) maleScore += 1;
  }

  if (femaleScore > maleScore) {
    return { gender: 'female', honorific: 'chị' };
  }
  if (maleScore > femaleScore) {
    return { gender: 'male', honorific: 'anh' };
  }

  return { gender: 'other', honorific: 'anh/chị' };
}

export function buildPersonalizedVariables(
  fullName: string,
  phone: string,
  explicitGender?: string
): PersonalizedVars {
  const cleanFullName = (fullName || '').trim();
  const cleanPhone = (phone || '').trim();
  const shortName = extractShortName(cleanFullName);
  const { gender, honorific } = detectGender(cleanFullName, explicitGender);

  let salutation: string = honorific;
  if (shortName && !shortName.startsWith('KH ') && !shortName.startsWith('Bạn bè ')) {
    salutation = `${honorific} ${shortName}`.trim();
  }

  const alias = cleanPhone ? `${cleanFullName || 'KH'} ${cleanPhone}`.trim() : cleanFullName;

  return {
    fullName: cleanFullName,
    shortName,
    honorific,
    salutation,
    phone: cleanPhone,
    alias,
    gender,
  };
}

/**
 * Thay thế SpinTax cú pháp {lựa chọn 1|lựa chọn 2|lựa chọn 3}
 * Hỗ trợ SpinTax lồng nhau: {Chào|{Dạ chào|Em chào}}
 * Bỏ qua các khối ngoặc nhọn không chứa ký tự '|' (như {name})
 */
export function parseSpintax(text: string): string {
  if (!text) return '';
  const spintaxRegex = /\{([^{}]*\|[^{}]*)\}/;
  let result = text;
  let iterations = 0;
  const maxIterations = 50;

  while (spintaxRegex.test(result) && iterations < maxIterations) {
    result = result.replace(spintaxRegex, (_, choices) => {
      const options = choices.split('|');
      const chosen = options[Math.floor(Math.random() * options.length)];
      return chosen !== undefined ? chosen : '';
    });
    iterations++;
  }

  return result;
}

export function replaceTemplateVariables(template: string, vars: PersonalizedVars): string {
  if (!template) return '';
  let replaced = template
    .replace(/\{\{\s*xung_ho\s*\}\}|\{xung_ho\}/gi, vars.honorific)
    .replace(/\{\{\s*(ten|short_name)\s*\}\}|\{(ten|short_name)\}/gi, vars.shortName || 'bạn')
    .replace(/\{\{\s*danh_xung\s*\}\}|\{danh_xung\}/gi, vars.salutation || 'bạn')
    .replace(/\{\{\s*name\s*\}\}|\{name\}/gi, vars.salutation || vars.shortName || 'bạn')
    .replace(/\{\{\s*(full_name|ho_ten)\s*\}\}|\{(full_name|ho_ten)\}/gi, vars.fullName || 'Quý khách')
    .replace(/\{\{\s*(phone|sdt)\s*\}\}|\{(phone|sdt)\}/gi, vars.phone || '');

  return parseSpintax(replaced);
}
