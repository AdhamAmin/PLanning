// --- SEED DATABASE ---
// These users are always guaranteed to exist in the system.
// Add permanent employees here. They will be merged with any registered users on startup.

export const SEED_USERS = [
  {
    id: "20071",
    username: "Adham",
    email: "adham@taskflow.com",
    role: "admin",
    nickname: "Chief",
    permanent: true,  // cannot be removed via the UI
  },
  {
    id: "528522",
    username: "Essam Hashem",
    email: "essam.drweee@gmail.com",
    role: "ceo",    // CEO with full access
    nickname: "CEO",
    permanent: true,
  },
];

// Sectors for the CRM system
export const SECTORS = [
  { id: 'SEC-001', name: 'E-Waste Export', nameAr: 'تصدير النفايات الإلكترونية' },
  { id: 'SEC-002', name: 'Toner Manufacturing (SpearInk)', nameAr: 'تصنيع الحبر (سبير إنك)' },
  { id: 'SEC-003', name: 'CSR Collection', nameAr: 'جمع المسؤولية الاجتماعية' },
  { id: 'SEC-004', name: 'Government Projects', nameAr: 'المشاريع الحكومية' },
  { id: 'SEC-005', name: 'International Partnerships', nameAr: 'الشراكات الدولية' },
  { id: 'SEC-006', name: 'Franchise (Dr. WEEE Hub)', nameAr: 'الامتياز (د. وي هب)' },
  { id: 'SEC-007', name: 'Water / GreenEco', nameAr: 'المياه / جرين إيكو' },
  { id: 'SEC-008', name: 'Scrap Trading', nameAr: 'تجارة الخردة' },
];

// Opportunity pipeline stages
export const PIPELINE_STAGES = [
  'Lead', 'Qualified', 'Negotiation', 'Proposal', 'Contract', 'Closed Won', 'Closed Lost'
];

// Opportunity types
export const OPPORTUNITY_TYPES = [
  'Shipment', 'Strategic Project', 'Collection Contract', 'Supply Contract',
  'Partnership', 'Franchise License', 'Bulk Purchase', 'Project', 'Distribution'
];

// Currency options
export const CURRENCIES = ['USD', 'EGP', 'EUR', 'GBP', 'SAR', 'AED', 'OMR'];

// Country codes (2-letter ISO)
export const COUNTRIES = [
  { code: 'EG', name: 'Egypt' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'UAE' }, { code: 'OM', name: 'Oman' },
  { code: 'DE', name: 'Germany' }, { code: 'IT', name: 'Italy' },
  { code: 'RS', name: 'Serbia' }, { code: 'NG', name: 'Nigeria' },
  { code: 'US', name: 'USA' }, { code: 'GB', name: 'UK' },
  { code: 'FR', name: 'France' }, { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' }, { code: 'JP', name: 'Japan' },
  { code: 'KW', name: 'Kuwait' }, { code: 'QA', name: 'Qatar' },
  { code: 'BH', name: 'Bahrain' }, { code: 'JO', name: 'Jordan' },
  { code: 'LB', name: 'Lebanon' }, { code: 'MA', name: 'Morocco' },
  { code: 'TN', name: 'Tunisia' }, { code: 'DZ', name: 'Algeria' },
  { code: 'TR', name: 'Turkey' }, { code: 'ZA', name: 'South Africa' },
];

// Protected user IDs — cannot be removed by anyone
export const PROTECTED_IDS = ['20071', '528522'];

/**
 * Merges seed users with stored users from localStorage.
 * Seed users always win on conflicts (by ID).
 * Returns the merged array.
 */
export function mergeWithSeed(storedUsers = []) {
  const merged = [...storedUsers];
  for (const seedUser of SEED_USERS) {
    const exists = merged.find(u => u.id === seedUser.id);
    if (!exists) {
      merged.unshift(seedUser); // add missing seed users to the front
    } else {
      // Update role/permanent flag from seed (don't overwrite nickname etc.)
      const idx = merged.indexOf(exists);
      merged[idx] = { ...exists, role: seedUser.role, permanent: seedUser.permanent };
    }
  }
  return merged;
}
