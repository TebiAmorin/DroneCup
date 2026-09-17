export const ASSETS = {
  r6Emblem: '/assets/r6-emblem.png',
  heroImage: '/assets/hero-wasteland.jpg',
  avatars: {
    caramelo: '/assets/avatars/caramelo.png',
    vetel: '/assets/avatars/vetel.png',
    miwell: '/assets/avatars/miwell.png',
    soramusic: '/assets/avatars/soramusic.png',
    barra: '/assets/avatars/barra.png',
  },
} as const;

export type CreatorSlug = keyof typeof CREATORS;

export const CREATORS = {
  caramelo: {
    name: 'Caramelo',
    twitch: 'CarameloOficial',
    color: '#eab308',
    registrationUrl: 'https://twitter.com/CarameloOficial',
    registrationPlatform: 'twitter' as const,
    registrationLabel: 'Inscribirme en Twitter/X',
    communityNote: 'Draft y plazas abiertas en su post de X',
  },
  vetel: {
    name: 'Vetel',
    twitch: 'Vetelcito01',
    color: '#38bdf8',
    registrationUrl: 'https://discord.gg/vetel',
    registrationPlatform: 'discord' as const,
    registrationLabel: 'Inscribirme en Discord',
    communityNote: 'Inscripciones en el canal #drone-cup',
  },
  miwell: {
    name: 'Miwell',
    twitch: 'DonMiwell',
    color: '#22c55e',
    registrationUrl: 'https://www.twitch.tv/DonMiwell',
    registrationPlatform: 'twitch' as const,
    registrationLabel: 'Inscribirme en Twitch',
    communityNote: 'Clasificatorio en directo durante su stream',
  },
  sora: {
    name: 'SoraMusic',
    twitch: 'soramusicr6',
    color: '#a855f7',
    registrationUrl: 'https://twitter.com/soramusicr6',
    registrationPlatform: 'twitter' as const,
    registrationLabel: 'Inscribirme en Twitter/X',
    communityNote: 'Responde al tweet oficial fijado',
  },
  barra: {
    name: 'Barra',
    twitch: 'barra',
    color: '#ef4444',
    registrationUrl: 'https://discord.gg/barra',
    registrationPlatform: 'discord' as const,
    registrationLabel: 'Inscribirme en Discord',
    communityNote: 'Formulario disponible en su servidor',
  },
} as const;

export const SCORING_TABLE = [
  { position: 1,  label: '1.er puesto', shortLabel: '1.º', points: 25, tier: 'gold' as const },
  { position: 2,  label: '2.º puesto',  shortLabel: '2.º', points: 18, tier: 'silver' as const },
  { position: 3,  label: '3.er puesto', shortLabel: '3.º', points: 15, tier: 'bronze' as const },
  { position: 4,  label: '4.º puesto',  shortLabel: '4.º', points: 12, tier: 'standard' as const },
  { position: 5,  label: '5.º puesto',  shortLabel: '5.º', points: 10, tier: 'standard' as const },
  { position: 6,  label: '6.º puesto',  shortLabel: '6.º', points: 8,  tier: 'standard' as const },
  { position: 7,  label: '7.º puesto',  shortLabel: '7.º', points: 6,  tier: 'standard' as const },
  { position: 8,  label: '8.º puesto',  shortLabel: '8.º', points: 4,  tier: 'standard' as const },
  { position: 9,  label: '9.º puesto',  shortLabel: '9.º', points: 2,  tier: 'standard' as const },
  { position: 10, label: '10.º puesto', shortLabel: '10.º', points: 1, tier: 'standard' as const },
  { position: null, label: 'DNF',       shortLabel: 'DNF', points: 0,  tier: 'dnf' as const },
] as const;

export const ICONS = {
  twitch: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  discord: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
};

export const TWITCH_ICON_SVG = ICONS.twitch;

export function getAvatarBySlug(slug: string): string | undefined {
  const key = slug.toLowerCase();
  if (key === 'sora') return ASSETS.avatars.soramusic;
  return ASSETS.avatars[key as keyof typeof ASSETS.avatars];
}

export function getCreatorBySlug(slug: string) {
  const key = slug.toLowerCase();
  if (key === 'soramusic' || key === 'sora') return CREATORS.sora;
  return CREATORS[key as keyof typeof CREATORS];
}

export const OFFICIAL_TEAM_COLORS: Record<string, string> = {
  caramelo: '#f5c842',
  vetel: '#3b82f6',
  miwell: '#22c55e',
  sora: '#a855f7',
  soramusic: '#a855f7',
  barra: '#ef4444',
  alpha: '#f5c842',
  beta: '#3b82f6',
  gamma: '#22c55e',
  delta: '#a855f7',
  epsilon: '#ef4444',
};

const PALETTE_FALLBACK = ['#f5c842', '#3b82f6', '#22c55e', '#a855f7', '#ef4444'];

export function getTeamColor(
  team: { slug?: string; name?: string; teamSlug?: string; teamName?: string; color?: string | null; teamColor?: string | null },
  index = 0
): string {
  const s = (team.slug || team.teamSlug || '').toLowerCase();
  const n = (team.name || team.teamName || '').toLowerCase();
  for (const [key, color] of Object.entries(OFFICIAL_TEAM_COLORS)) {
    if (s.includes(key) || n.includes(key)) return color;
  }
  const explicit = team.color || team.teamColor;
  if (explicit && explicit !== '#aaa' && explicit !== '#000000') return explicit;
  return PALETTE_FALLBACK[index % PALETTE_FALLBACK.length];
}

