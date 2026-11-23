import type { HeroId } from './types';

export interface RpgCharacterProfile {
  id: HeroId;
  name: string;
  title: string;
  roleBadge: string;
  roleSummary: string;
  personality: string;
  portraitUrl: string;
  accentColor: string;
  secondaryColor: string;
  companionName: string;
  skillQuote: string;
}

export const RPG_CHARACTER_PROFILES: Record<HeroId, RpgCharacterProfile> = {
  sparkle: {
    id: 'sparkle',
    name: 'Sparkle',
    title: 'Ilusionis Teatrikal Topeng Rubah',
    roleBadge: 'Pemberi Bonus Hadiah',
    roleSummary:
      'Setiap interaksi kuis, peti, dan teka-teki mendapat bonus +8 Stellar Jades, serta skill [F] Panggung Ilusi memicu hujan kartu emas +5 Jades.',
    personality: 'Ekspresif, percaya diri, teatrikal, dan misterius.',
    portraitUrl: '/src/assets/images/rpg_sparkle_portrait_1795259159235.jpg',
    accentColor: '#fda4af',
    secondaryColor: '#e11d48',
    companionName: 'Kitsune Lintang',
    skillQuote: 'Pertunjukan dimulai! Nikmati kilau bonus hadiah dari panggung ilusi~',
  },
  sparxie: {
    id: 'sparxie',
    name: 'Sparxie',
    title: 'Navigator Kompas Bintang Nusantara',
    roleBadge: 'Pemburu & Penunjuk Artefak',
    roleSummary:
      'Skill [F] Radar Pusaka memancarkan sinar kompas emas langsung menuju artefak tersembunyi terdekat + daya lompat lebih tinggi.',
    personality: 'Energik, ceria, ekspresif, dan penuh semangat.',
    portraitUrl: '/src/assets/images/rpg_sparxie_portrait_v2_1795259185308.jpg',
    accentColor: '#f7d996',
    secondaryColor: '#f43f5e',
    companionName: 'Bintang Kelinci',
    skillQuote: 'Ayo melesat! Komasku menunjuk tepat ke peninggalan budaya tersembunyi!',
  },
  sampo: {
    id: 'sampo',
    name: 'Sampo',
    title: 'Negosiator Rahasia Lintas Dimensi',
    roleBadge: 'Pembuka Misi Rahasia & Kejutan',
    roleSummary:
      'Skill [F] Kunci Lintas Pasar membuka tabir zona rahasia, menyorot peti tersembunyi, memberi kejutan Jades, kecepatan +25%, dan 1x Petunjuk Gratis.',
    personality: 'Jenaka, percaya diri, licik, dan penuh akal.',
    portraitUrl: '/src/assets/images/rpg_sampo_portrait_1795259160529.jpg',
    accentColor: '#6ee7b7',
    secondaryColor: '#3b82f6',
    companionName: 'Kartu Ajaib',
    skillQuote: 'Ssst, rahasia antar kita berdua—tabir tersembunyi barusan kubuka untukmu!',
  },
  nihilux: {
    id: 'nihilux',
    name: 'Nihilux',
    title: 'Sarjana Kosmik Pluriversal',
    roleBadge: 'Pelindung & Penakluk Boss',
    roleSummary:
      'Melindungi pemain dengan Perisai Epistemik saat melawan Boss dan memancarkan energi kosmik [F] Lensa Pluriversal untuk melemahkan Cultural Void.',
    personality: 'Misterius, kuat, elegan, dan menyatu dengan energi kosmik.',
    portraitUrl: '/src/assets/images/rpg_nihilux_portrait_1795259160752.jpg',
    accentColor: '#ddd6fe',
    secondaryColor: '#a855f7',
    companionName: 'Astrolab Nebula',
    skillQuote: 'Biarlah energi kosmik menyingkap kebenaran dan meruntuhkan segel penjaga.',
  },
};

export function getRpgCharacterProfile(heroId: HeroId): RpgCharacterProfile {
  return RPG_CHARACTER_PROFILES[heroId] || RPG_CHARACTER_PROFILES.sparxie;
}
