/**
 * Utility functions for user-defined custom categories and data hygiene.
 * Ensures zero default categories and zero default products,
 * allowing any business to define its own catalog from scratch.
 */

const FORBIDDEN_WORDS = ['perfume', 'fragancia', 'fragrance'];

export function isForbiddenCategory(cat: string): boolean {
  if (!cat || typeof cat !== 'string') return true;
  const lower = cat.toLowerCase().trim();
  return FORBIDDEN_WORDS.some(word => lower.includes(word));
}

export function getUserCategories(userEmail?: string): string[] {
  const key = `gt_user_categories_${userEmail || 'guest'}`;
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    
    // Filter out any legacy fragrance / perfume categories
    const cleaned = parsed.filter(c => c && typeof c === 'string' && !isForbiddenCategory(c));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveUserCategories(cats: string[], userEmail?: string): string[] {
  const key = `gt_user_categories_${userEmail || 'guest'}`;
  const cleaned = cats.filter(c => c && typeof c === 'string' && !isForbiddenCategory(c));
  try {
    localStorage.setItem(key, JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent('gt_categories_updated', { detail: { categories: cleaned } }));
  } catch (e) {
    console.warn('Could not save user categories to localStorage:', e);
  }
  return cleaned;
}

export function addUserCategory(cat: string, userEmail?: string): string[] {
  const trimmed = cat.trim();
  if (!trimmed || isForbiddenCategory(trimmed)) return getUserCategories(userEmail);
  const current = getUserCategories(userEmail);
  if (!current.includes(trimmed)) {
    const next = [...current, trimmed];
    return saveUserCategories(next, userEmail);
  }
  return current;
}

export function deleteUserCategory(cat: string, userEmail?: string): string[] {
  const current = getUserCategories(userEmail);
  const next = current.filter(c => c !== cat);
  return saveUserCategories(next, userEmail);
}

/**
 * Scrubs any legacy demo or perfume data from local storage for the given user.
 */
export function purgeLegacyPerfumeData(userEmail?: string): void {
  const emailKey = userEmail || 'guest';
  
  // 1. Scrub user categories
  getUserCategories(userEmail);

  // 2. Scrub inventory in local storage
  const invKey = `gt_inventory_${emailKey}`;
  try {
    const savedInv = localStorage.getItem(invKey);
    if (savedInv) {
      const parsed = JSON.parse(savedInv);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(item => {
          if (!item) return false;
          const lowerName = (item.name || '').toLowerCase();
          const lowerCat = (item.category || '').toLowerCase();
          const isSample = 
            item.id?.startsWith('perfume-') || 
            item.id?.startsWith('sample-') || 
            item.id?.startsWith('p-') ||
            lowerName.includes('perfume') || 
            lowerName.includes('fragancia') || 
            lowerName.includes('club de nuit') || 
            lowerName.includes('yara') || 
            lowerName.includes('lattafa') || 
            lowerName.includes('sauvage') || 
            lowerName.includes('asad') || 
            lowerCat.includes('perfume') || 
            lowerCat.includes('fragancia');
          return !isSample;
        });
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(invKey, JSON.stringify(cleaned));
        }
      }
    }
  } catch (e) {}

  // 3. Clean audit logs
  try {
    const logsKey = 'gt_audit_trail_logs';
    const savedLogs = localStorage.getItem(logsKey);
    if (savedLogs) {
      const parsed = JSON.parse(savedLogs);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(l => {
          const lower = (l.details || '').toLowerCase() + (l.action || '').toLowerCase();
          return !lower.includes('fragancia') && !lower.includes('perfume');
        });
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(logsKey, JSON.stringify(cleaned));
        }
      }
    }
  } catch (e) {}
}
