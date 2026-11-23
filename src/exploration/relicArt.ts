import type { RelicCategory } from './types';

const CATEGORY_GLOW: Record<RelicCategory, { primary: string; secondary: string }> = {
  local: { primary: '#34d399', secondary: '#f7d996' },
  global: { primary: '#38bdf8', secondary: '#a5f3fc' },
  glocal: { primary: '#f7d996', secondary: '#fb7185' },
  lost: { primary: '#c084fc', secondary: '#e9d5ff' },
};

function getRelicInnerSvg(artKey: string): string {
  switch (artKey) {
    // =========================================================================
    // PLANET 1 — TERRA NUSANTARA (15 LOCAL RELICS)
    // =========================================================================
    case 'batik':
      return `
        <path d="M22 20 L74 20 L70 76 L26 76 Z" fill="#78350f" stroke="#f7d996" stroke-width="2.2"/>
        <circle cx="48" cy="38" r="8" fill="none" stroke="#fde68a" stroke-width="1.8"/>
        <circle cx="38" cy="48" r="7" fill="none" stroke="#fde68a" stroke-width="1.6"/>
        <circle cx="58" cy="48" r="7" fill="none" stroke="#fde68a" stroke-width="1.6"/>
        <circle cx="48" cy="58" r="8" fill="none" stroke="#fde68a" stroke-width="1.8"/>
        <circle cx="48" cy="48" r="3.5" fill="#f59e0b"/>
        <path d="M26 68 Q48 60 70 68" fill="none" stroke="#f7d996" stroke-width="1.8" stroke-dasharray="3 2"/>`;
    case 'angklung':
      return `
        <rect x="20" y="66" width="56" height="8" rx="3" fill="#92400e" stroke="#f7d996" stroke-width="1.8"/>
        <path d="M26 20 V68 M70 20 V68 M24 24 H72" stroke="#b45309" stroke-width="4" stroke-linecap="round"/>
        <path d="M36 26 L36 66 L44 66 L44 34 Z" fill="#fde68a" stroke="#78350f" stroke-width="1.6"/>
        <path d="M52 18 L52 66 L61 66 L61 28 Z" fill="#f7d996" stroke="#78350f" stroke-width="1.6"/>`;
    case 'wayang_kulit':
      return `
        <path d="M48 14 L56 26 L68 38 L58 52 L66 72 L48 64 L30 72 L38 52 L28 38 L40 26 Z" fill="#f59e0b" stroke="#fef3c7" stroke-width="2"/>
        <circle cx="48" cy="30" r="5.5" fill="#78350f" stroke="#fde68a" stroke-width="1.5"/>
        <path d="M48 72 V82 M32 72 L22 52 M64 72 L74 52" stroke="#f7d996" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'tenun_ikat':
      return `
        <rect x="24" y="18" width="48" height="58" rx="4" fill="#991b1b" stroke="#fde68a" stroke-width="2"/>
        <path d="M24 30 H72 M24 46 H72 M24 62 H72" stroke="#f59e0b" stroke-width="3"/>
        <polygon points="48,33 56,38 48,43 40,38" fill="#fef3c7"/>
        <polygon points="36,50 42,54 36,58 30,54" fill="#38bdf8"/>
        <polygon points="60,50 66,54 60,58 54,54" fill="#38bdf8"/>
        <path d="M28 76 V84 M36 76 V84 M44 76 V84 M52 76 V84 M60 76 V84 M68 76 V84" stroke="#fde68a" stroke-width="2" stroke-linecap="round"/>`;
    case 'ulos':
      return `
        <path d="M28 16 H68 L64 76 H32 Z" fill="#7f1d1d" stroke="#f7d996" stroke-width="2"/>
        <rect x="33" y="16" width="6" height="60" fill="#111827"/>
        <rect x="57" y="16" width="6" height="60" fill="#111827"/>
        <path d="M32 32 H64 M32 46 H64 M32 60 H64" stroke="#fef3c7" stroke-width="2"/>
        <polygon points="48,22 53,27 48,32 43,27" fill="#f59e0b"/>
        <path d="M34 76 V84 M41 76 V84 M48 76 V84 M55 76 V84 M62 76 V84" stroke="#fef3c7" stroke-width="1.8" stroke-linecap="round"/>`;
    case 'songket':
      return `
        <path d="M22 20 L74 20 L70 76 L26 76 Z" fill="#6b0f2b" stroke="#f7d996" stroke-width="2.4"/>
        <polygon points="48,28 58,42 48,56 38,42" fill="#f7d996" fill-opacity="0.9"/>
        <polygon points="48,34 53,42 48,50 43,42" fill="#6b0f2b"/>
        <path d="M26 62 L36 56 L48 64 L60 56 L70 62" fill="none" stroke="#fde68a" stroke-width="2.2"/>
        <circle cx="33" cy="30" r="2.5" fill="#fde68a"/>
        <circle cx="63" cy="30" r="2.5" fill="#fde68a"/>`;
    case 'noken':
      return `
        <path d="M30 40 C30 16, 66 16, 66 40" fill="none" stroke="#d97706" stroke-width="4" stroke-linecap="round"/>
        <path d="M24 40 L72 40 L66 76 Q48 82 30 76 Z" fill="#92400e" stroke="#f7d996" stroke-width="2"/>
        <path d="M28 48 L68 58 M28 58 L66 68 M68 48 L28 58 M66 58 L30 68" stroke="#fbbf24" stroke-width="1.5" opacity="0.85"/>`;
    case 'sasando':
      return `
        <path d="M48 16 C68 20, 76 42, 70 66 C62 78, 34 78, 26 66 C20 42, 28 20, 48 16 Z" fill="#d97706" fill-opacity="0.3" stroke="#fde68a" stroke-width="2"/>
        <rect x="44" y="14" width="8" height="66" rx="3" fill="#b45309" stroke="#f7d996" stroke-width="1.8"/>
        <path d="M42 24 V68 M36 28 V64 M54 24 V68 M60 28 V64" stroke="#fef3c7" stroke-width="1.3"/>`;
    case 'kolintang':
      return `
        <polygon points="16,58 80,50 76,68 20,74" fill="#5c2d16" stroke="#f7d996" stroke-width="2"/>
        <rect x="20" y="42" width="7" height="20" rx="2" fill="#d97706" stroke="#fde68a" stroke-width="1.2"/>
        <rect x="30" y="39" width="7" height="22" rx="2" fill="#b45309" stroke="#fde68a" stroke-width="1.2"/>
        <rect x="40" y="36" width="7" height="24" rx="2" fill="#d97706" stroke="#fde68a" stroke-width="1.2"/>
        <rect x="50" y="33" width="7" height="26" rx="2" fill="#b45309" stroke="#fde68a" stroke-width="1.2"/>
        <rect x="60" y="30" width="7" height="27" rx="2" fill="#d97706" stroke="#fde68a" stroke-width="1.2"/>
        <rect x="70" y="27" width="7" height="28" rx="2" fill="#b45309" stroke="#fde68a" stroke-width="1.2"/>
        <path d="M26 24 L42 36 M66 20 L54 32" stroke="#fef3c7" stroke-width="2" stroke-linecap="round"/>
        <circle cx="42" cy="36" r="3" fill="#fde68a"/>
        <circle cx="54" cy="32" r="3" fill="#fde68a"/>`;
    case 'tifa':
      return `
        <path d="M30 22 H66 L58 48 L64 74 H32 L38 48 Z" fill="#7c2d12" stroke="#f7d996" stroke-width="2.2"/>
        <ellipse cx="48" cy="22" rx="18" ry="5.5" fill="#fef3c7" stroke="#d97706" stroke-width="1.8"/>
        <path d="M36 44 H60 M35 56 L48 64 L61 56" fill="none" stroke="#fde68a" stroke-width="1.8"/>
        <path d="M56 36 C68 38, 68 58, 56 60" fill="none" stroke="#d97706" stroke-width="3" stroke-linecap="round"/>`;
    case 'keris':
      return `
        <path d="M56 16 C64 20, 62 30, 52 32 L46 32 C42 26, 48 16, 56 16 Z" fill="#92400e" stroke="#f7d996" stroke-width="2"/>
        <path d="M36 33 H60 L54 39 H42 Z" fill="#f7d996"/>
        <path d="M48 39 C54 45, 42 51, 48 57 C54 63, 43 69, 48 80 C45 71, 40 65, 45 58 C50 51, 40 46, 48 39 Z" fill="#cbd5e1" stroke="#f8fafc" stroke-width="1.4"/>
        <path d="M47 44 L48 72" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 2"/>`;
    case 'topeng_cirebon':
      return `
        <path d="M28 22 Q48 12 68 22 Q74 50 62 72 Q48 82 34 72 Q22 50 28 22 Z" fill="#fef3c7" stroke="#e11d48" stroke-width="2.4"/>
        <path d="M28 24 Q48 16 68 24 L64 32 Q48 26 32 32 Z" fill="#e5b869"/>
        <path d="M35 42 Q40 38 45 42 M51 42 Q56 38 61 42" stroke="#1e293b" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <path d="M48 44 L45 56 H51 Z" fill="#e11d48"/>
        <path d="M40 65 Q48 70 56 65" stroke="#991b1b" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case 'ukiran_jepara':
      return `
        <rect x="20" y="20" width="56" height="56" rx="10" fill="#5c2d16" stroke="#e5b869" stroke-width="2.4"/>
        <path d="M48 66 C34 62 28 46 38 34 C44 26 56 34 48 46 C42 54 58 58 64 42 C68 32 56 24 48 26" fill="none" stroke="#f7d996" stroke-width="3" stroke-linecap="round"/>
        <circle cx="48" cy="48" r="4" fill="#fde68a"/>`;
    case 'congklak':
      return `
        <path d="M12 48 Q48 26 84 48 Q48 70 12 48 Z" fill="#78350f" stroke="#f7d996" stroke-width="2.2"/>
        <circle cx="22" cy="48" r="5.5" fill="#451a03" stroke="#e5b869" stroke-width="1.2"/>
        <circle cx="74" cy="48" r="5.5" fill="#451a03" stroke="#e5b869" stroke-width="1.2"/>
        <circle cx="35" cy="43" r="3" fill="#fde68a"/>
        <circle cx="44" cy="42" r="3" fill="#fde68a"/>
        <circle cx="53" cy="42" r="3" fill="#fde68a"/>
        <circle cx="62" cy="43" r="3" fill="#fde68a"/>
        <circle cx="35" cy="53" r="3" fill="#34d399"/>
        <circle cx="44" cy="54" r="3" fill="#34d399"/>
        <circle cx="53" cy="54" r="3" fill="#34d399"/>
        <circle cx="62" cy="53" r="3" fill="#34d399"/>`;
    case 'rumah_gadang':
      return `
        <path d="M14 42 Q32 48 48 20 Q64 48 82 42 Q68 54 48 50 Q28 54 14 42 Z" fill="#b45309" stroke="#f7d996" stroke-width="2.2"/>
        <rect x="26" y="48" width="44" height="22" fill="#78350f" stroke="#e5b869" stroke-width="2"/>
        <rect x="44" y="54" width="8" height="16" fill="#fde68a"/>
        <path d="M30 70 V80 M42 70 V80 M54 70 V80 M66 70 V80" stroke="#e5b869" stroke-width="2.5"/>`;

    // =========================================================================
    // PLANET 2 — NOVA METROPOLIS (15 GLOBAL RELICS)
    // =========================================================================
    case 'holo_phone':
      return `
        <rect x="31" y="26" width="34" height="52" rx="6" fill="#0f172a" stroke="#38bdf8" stroke-width="2.4"/>
        <rect x="35" y="32" width="26" height="36" rx="3" fill="#1e3a8a"/>
        <polygon points="48,14 64,28 48,42 32,28" fill="#38bdf8" fill-opacity="0.35" stroke="#a5f3fc" stroke-width="1.8"/>
        <circle cx="48" cy="73" r="2.2" fill="#7dd3fc"/>`;
    case 'laptop':
      return `
        <rect x="22" y="24" width="52" height="34" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="2.2"/>
        <rect x="27" y="29" width="42" height="24" rx="2" fill="#1e3a8a"/>
        <path d="M33 37 H55 M33 43 H48" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
        <polygon points="14,62 82,62 76,72 20,72" fill="#334155" stroke="#a5f3fc" stroke-width="1.8"/>`;
    case 'kamera_digital':
      return `
        <rect x="18" y="32" width="60" height="40" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="2.2"/>
        <path d="M32 32 L38 24 H56 L62 32 Z" fill="#334155" stroke="#7dd3fc" stroke-width="1.6"/>
        <circle cx="48" cy="52" r="13" fill="#0f172a" stroke="#a5f3fc" stroke-width="2.4"/>
        <circle cx="48" cy="52" r="7" fill="#0284c7"/>
        <circle cx="45" cy="49" r="2" fill="#ffffff"/>
        <rect x="64" y="37" width="8" height="5" rx="1.5" fill="#fde68a"/>`;
    case 'headphone':
      return `
        <path d="M24 52 C24 24, 72 24, 72 52" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
        <rect x="18" y="48" width="12" height="24" rx="5" fill="#0f172a" stroke="#a5f3fc" stroke-width="2.2"/>
        <rect x="66" y="48" width="12" height="24" rx="5" fill="#0f172a" stroke="#a5f3fc" stroke-width="2.2"/>
        <path d="M24 54 V66 M72 54 V66" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>`;
    case 'music_disc':
      return `
        <circle cx="48" cy="48" r="28" fill="#1e293b" stroke="#38bdf8" stroke-width="2.4"/>
        <circle cx="48" cy="48" r="20" fill="none" stroke="#a5f3fc" stroke-width="1.2" stroke-dasharray="14 6"/>
        <circle cx="48" cy="48" r="9" fill="#38bdf8" stroke="#ffffff" stroke-width="1.6"/>
        <circle cx="48" cy="48" r="3" fill="#070b18"/>`;
    case 'sneakers_global':
      return `
        <path d="M18 58 L30 34 L44 38 L58 48 L78 52 L80 64 H18 Z" fill="#0284c7" stroke="#e0f2fe" stroke-width="2.2"/>
        <path d="M20 64 H79" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
        <path d="M35 42 L45 54 M43 41 L53 53" stroke="#38bdf8" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'jaket_streetwear':
      return `
        <path d="M30 22 L40 18 L48 26 L56 18 L66 22 L78 36 L70 46 L66 40 V74 H30 V40 L26 46 L18 36 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="2.2"/>
        <path d="M48 26 V74" stroke="#7dd3fc" stroke-width="2"/>
        <rect x="34" y="48" width="8" height="10" rx="2" fill="#1e3a8a" stroke="#7dd3fc" stroke-width="1.2"/>
        <rect x="54" y="48" width="8" height="10" rx="2" fill="#1e3a8a" stroke="#7dd3fc" stroke-width="1.2"/>`;
    case 'robot_asisten':
      return `
        <path d="M48 16 V26" stroke="#a5f3fc" stroke-width="2.4"/>
        <circle cx="48" cy="14" r="3.5" fill="#38bdf8"/>
        <rect x="28" y="26" width="40" height="28" rx="9" fill="#1e293b" stroke="#38bdf8" stroke-width="2.2"/>
        <circle cx="39" cy="40" r="4" fill="#38bdf8"/>
        <circle cx="57" cy="40" r="4" fill="#38bdf8"/>
        <rect x="33" y="56" width="30" height="20" rx="6" fill="#0f172a" stroke="#7dd3fc" stroke-width="2"/>
        <path d="M22 60 L33 62 M74 60 L63 62" stroke="#a5f3fc" stroke-width="3" stroke-linecap="round"/>`;
    case 'jam_pintar':
      return `
        <rect x="38" y="14" width="20" height="16" rx="3" fill="#334155" stroke="#7dd3fc" stroke-width="1.6"/>
        <rect x="38" y="66" width="20" height="16" rx="3" fill="#334155" stroke="#7dd3fc" stroke-width="1.6"/>
        <rect x="28" y="28" width="40" height="40" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="2.4"/>
        <circle cx="48" cy="48" r="12" fill="none" stroke="#34d399" stroke-width="2.6" stroke-dasharray="52 18"/>
        <path d="M48 41 V48 L54 51" stroke="#e0f2fe" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'shopping_card':
      return `
        <rect x="16" y="28" width="64" height="40" rx="7" fill="#0f294a" stroke="#38bdf8" stroke-width="2.4"/>
        <rect x="16" y="37" width="64" height="8" fill="#38bdf8" opacity="0.65"/>
        <rect x="24" y="51" width="14" height="10" rx="2" fill="#f7d996"/>
        <path d="M56 54 C60 50, 64 50, 68 54 M59 58 C61 55, 63 55, 65 58" fill="none" stroke="#a5f3fc" stroke-width="2" stroke-linecap="round"/>`;
    case 'buku_digital':
      return `
        <rect x="24" y="18" width="48" height="60" rx="6" fill="#0f172a" stroke="#38bdf8" stroke-width="2.4"/>
        <rect x="30" y="24" width="36" height="44" rx="2" fill="#1e3a8a"/>
        <path d="M35 33 H61 M35 41 H61 M35 49 H54 M35 57 H58" stroke="#e0f2fe" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="48" cy="73" r="2" fill="#7dd3fc"/>`;
    case 'konsol_permainan':
      return `
        <path d="M22 40 C22 32, 34 32, 38 36 H58 C62 32, 74 32, 74 40 L78 62 C78 70, 68 72, 62 64 L56 56 H40 L34 64 C28 72, 18 70, 18 62 Z" fill="#1e293b" stroke="#38bdf8" stroke-width="2.2"/>
        <path d="M30 43 V51 M26 47 H34" stroke="#e0f2fe" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="62" cy="44" r="2.5" fill="#fb7185"/>
        <circle cx="68" cy="49" r="2.5" fill="#facc15"/>
        <circle cx="57" cy="49" r="2.5" fill="#34d399"/>`;
    case 'kamera_instan':
      return `
        <rect x="22" y="22" width="52" height="52" rx="10" fill="#f8fafc" stroke="#38bdf8" stroke-width="2.4"/>
        <rect x="22" y="48" width="52" height="6" fill="#fb7185"/>
        <circle cx="48" cy="42" r="11" fill="#0f172a" stroke="#38bdf8" stroke-width="2.2"/>
        <circle cx="48" cy="42" r="5" fill="#0284c7"/>
        <rect x="32" y="62" width="32" height="6" rx="2" fill="#0f172a"/>`;
    case 'satelit_komunikasi':
      return `
        <rect x="14" y="38" width="20" height="20" rx="2" fill="#1d4ed8" stroke="#7dd3fc" stroke-width="1.8"/>
        <rect x="62" y="38" width="20" height="20" rx="2" fill="#1d4ed8" stroke="#7dd3fc" stroke-width="1.8"/>
        <rect x="38" y="34" width="20" height="28" rx="4" fill="#334155" stroke="#a5f3fc" stroke-width="2"/>
        <path d="M48 62 V74 M38 74 H58" stroke="#f7d996" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M40 24 Q48 16 56 24 M34 18 Q48 8 62 18" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>`;
    case 'media_crystal':
      return `
        <rect x="24" y="64" width="48" height="12" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
        <polygon points="48,16 70,38 58,60 38,60 26,38" fill="#0284c7" fill-opacity="0.48" stroke="#a5f3fc" stroke-width="2"/>
        <polygon points="44,34 56,41 44,48" fill="#ffffff"/>`;

    // =========================================================================
    // PLANET 3 — FUSION KINGDOM (15 GLOCAL CREATIONS)
    // =========================================================================
    case 'batik_streetwear':
      return `
        <path d="M30 22 L40 18 L48 26 L56 18 L66 22 L78 36 L70 46 L66 40 V74 H30 V40 L26 46 L18 36 Z" fill="#1e1b4b" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M38 34 H58 M34 46 H62 M34 58 H62" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3"/>
        <circle cx="48" cy="46" r="5" fill="#fde68a"/>`;
    case 'pattern_sneakers':
      return `
        <path d="M18 58 L32 36 L44 40 L56 48 L78 52 L80 64 H18 Z" fill="#1e293b" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M22 64 H78" stroke="#fef3c7" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M34 44 L44 56 M42 42 L52 54" stroke="#fb7185" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'modern_angklung':
      return `
        <rect x="24" y="24" width="48" height="48" rx="8" fill="#1e1b4b" stroke="#38bdf8" stroke-width="2"/>
        <path d="M36 30 V66 H43 V36 Z M51 24 V66 H59 V32 Z" fill="#f7d996" stroke="#78350f" stroke-width="1.4"/>
        <path d="M64 36 C70 42 70 52 64 58 M69 30 C78 40 78 54 69 64" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>`;
    case 'digital_wayang':
      return `
        <rect x="18" y="22" width="60" height="44" rx="6" fill="#0f172a" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M48 28 L55 38 L52 56 L48 60 L44 56 L41 38 Z" fill="#f59e0b" stroke="#fef3c7" stroke-width="1.4"/>
        <path d="M36 74 H60 M48 66 V74" stroke="#38bdf8" stroke-width="2.8" stroke-linecap="round"/>`;
    case 'jamu_modern':
      return `
        <rect x="38" y="16" width="20" height="9" rx="3" fill="#f7d996"/>
        <path d="M34 25 H62 L66 74 Q48 79 30 74 Z" fill="#d97706" stroke="#fde68a" stroke-width="2"/>
        <rect x="33" y="42" width="30" height="18" rx="3" fill="#fef3c7"/>
        <path d="M48 45 C44 48, 44 54, 48 57 C52 54, 52 48, 48 45 Z" fill="#16a34a"/>`;
    case 'burger_rendang':
      return `
        <path d="M24 40 C24 22, 72 22, 72 40 Z" fill="#d97706" stroke="#fde68a" stroke-width="2"/>
        <path d="M22 44 Q35 49 48 44 T74 44" fill="none" stroke="#34d399" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="22" y="48" width="52" height="11" rx="5" fill="#7c2d12" stroke="#f59e0b" stroke-width="1.6"/>
        <path d="M24 62 H72 C72 72, 24 72, 24 62 Z" fill="#b45309" stroke="#fde68a" stroke-width="1.8"/>`;
    case 'pizza_rendang':
      return `
        <polygon points="48,18 76,72 20,72" fill="#f59e0b" stroke="#fde68a" stroke-width="2.2"/>
        <path d="M20 68 Q48 76 76 68" fill="none" stroke="#b45309" stroke-width="6" stroke-linecap="round"/>
        <circle cx="48" cy="42" r="5" fill="#7c2d12"/>
        <circle cx="38" cy="57" r="5" fill="#7c2d12"/>
        <circle cx="57" cy="56" r="5" fill="#7c2d12"/>
        <circle cx="47" cy="52" r="2.5" fill="#34d399"/>`;
    case 'tas_noken_modern':
      return `
        <path d="M34 36 C34 18, 62 18, 62 36" fill="none" stroke="#38bdf8" stroke-width="3.6" stroke-linecap="round"/>
        <rect x="26" y="36" width="44" height="40" rx="8" fill="#78350f" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M30 46 L66 56 M30 56 L66 66 M66 46 L30 56" stroke="#fde68a" stroke-width="1.6"/>
        <rect x="40" y="46" width="16" height="10" rx="3" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>`;
    case 'fusion_fashion':
      return `
        <path d="M36 18 L48 28 L60 18 L68 38 L60 76 H36 L28 38 Z" fill="#7c2d12" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M48 28 V76" stroke="#fde68a" stroke-width="1.8"/>
        <path d="M34 52 L62 60 M36 62 L60 70" stroke="#f472b6" stroke-width="2"/>`;
    case 'kolintang_digital':
      return `
        <rect x="16" y="28" width="64" height="42" rx="7" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
        <rect x="22" y="36" width="8" height="24" rx="2" fill="#f7d996"/>
        <rect x="33" y="34" width="8" height="26" rx="2" fill="#d97706"/>
        <rect x="44" y="32" width="8" height="28" rx="2" fill="#f7d996"/>
        <rect x="55" y="30" width="8" height="30" rx="2" fill="#d97706"/>
        <circle cx="71" cy="40" r="3" fill="#34d399"/>
        <circle cx="71" cy="52" r="3" fill="#fb7185"/>`;
    case 'animasi_rakyat':
      return `
        <rect x="18" y="24" width="60" height="48" rx="7" fill="#1e1b4b" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M18 35 H78 M30 24 L36 35 M48 24 L54 35 M66 24 L72 35" stroke="#fde68a" stroke-width="2"/>
        <polygon points="43,43 59,52 43,61" fill="#fb7185"/>`;
    case 'komik_legenda':
      return `
        <rect x="20" y="20" width="56" height="56" rx="5" fill="#fef3c7" stroke="#f7d996" stroke-width="2.4"/>
        <rect x="25" y="25" width="21" height="22" fill="#312e81"/>
        <rect x="50" y="25" width="21" height="22" fill="#be123c"/>
        <rect x="25" y="51" width="46" height="20" fill="#0f766e"/>
        <path d="M40 36 L54 32 L50 42 Z" fill="#facc15"/>`;
    case 'festival_musik':
      return `
        <path d="M16 68 L28 32 H68 L80 68 Z" fill="#312e81" stroke="#f7d996" stroke-width="2.2"/>
        <circle cx="48" cy="46" r="10" fill="#f59e0b" stroke="#fde68a" stroke-width="1.8"/>
        <path d="M26 24 L38 36 M70 24 L58 36 M48 16 V32" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/>
        <rect x="24" y="64" width="48" height="8" rx="3" fill="#f7d996"/>`;
    case 'local_brand':
      return `
        <polygon points="48,14 68,24 72,50 48,80 24,50 28,24" fill="#4c1d95" stroke="#f7d996" stroke-width="2.4"/>
        <path d="M48 24 L54 40 L70 46 L54 52 L48 68 L42 52 L26 46 L42 40 Z" fill="#f7d996"/>
        <circle cx="48" cy="46" r="5" fill="#1e1b4b"/>`;
    case 'aplikasi_bahasa':
      return `
        <rect x="28" y="16" width="40" height="64" rx="8" fill="#0f172a" stroke="#f7d996" stroke-width="2.4"/>
        <rect x="33" y="24" width="30" height="44" rx="3" fill="#312e81"/>
        <path d="M37 32 H57 V42 H45 L39 47 V42 H37 Z" fill="#34d399"/>
        <text x="48" y="59" text-anchor="middle" fill="#fde68a" font-family="Cinzel, serif" font-size="11" font-weight="800">Aa</text>`;

    // =========================================================================
    // PLANET 4 — LOST CIVILIZATION (15 LOST KNOWLEDGE)
    // =========================================================================
    case 'preservation_scroll':
      return `
        <rect x="20" y="34" width="56" height="28" rx="4" fill="#fde68a" stroke="#c084fc" stroke-width="2"/>
        <circle cx="34" cy="48" r="2.6" fill="#581c87"/>
        <circle cx="62" cy="48" r="2.6" fill="#581c87"/>
        <path d="M40 43 H56 M40 49 H56 M40 55 H52" stroke="#581c87" stroke-width="1.8" stroke-linecap="round"/>`;
    case 'cerita_rakyat':
      return `
        <path d="M18 26 Q34 22 48 30 Q62 22 78 26 V68 Q62 64 48 72 Q34 64 18 68 Z" fill="#3b0764" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M48 30 V72" stroke="#e9d5ff" stroke-width="1.8"/>
        <path d="M25 38 H41 M25 46 H41 M55 38 H71 M55 46 H71" stroke="#fde68a" stroke-width="1.8" stroke-linecap="round"/>`;
    case 'bahasa_daerah':
      return `
        <rect x="20" y="28" width="56" height="40" rx="7" fill="#1e1b4b" stroke="#c084fc" stroke-width="2.2"/>
        <circle cx="35" cy="48" r="7" fill="none" stroke="#f7d996" stroke-width="2.2"/>
        <circle cx="61" cy="48" r="7" fill="none" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M35 55 H61" stroke="#38bdf8" stroke-width="2"/>
        <path d="M48 32 V40" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round"/>`;
    case 'tradisi_lisan':
      return `
        <path d="M26 30 H62 V54 H42 L30 64 V54 H26 Z" fill="#581c87" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M68 34 C74 40 74 50 68 56 M74 28 C82 38 82 52 74 62" fill="none" stroke="#c084fc" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="36" cy="42" r="2.5" fill="#fde68a"/>
        <circle cx="44" cy="42" r="2.5" fill="#fde68a"/>
        <circle cx="52" cy="42" r="2.5" fill="#fde68a"/>`;
    case 'tari_tradisional':
      return `
        <path d="M48 64 L20 40 C30 22, 66 22, 76 40 Z" fill="#be185d" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M48 64 L32 30 M48 64 V26 M48 64 L64 30" stroke="#fde68a" stroke-width="1.6"/>
        <circle cx="48" cy="66" r="4" fill="#e9d5ff"/>`;
    case 'musik_daerah':
      return `
        <rect x="24" y="20" width="48" height="56" rx="5" fill="#2e1065" stroke="#c084fc" stroke-width="2.2"/>
        <path d="M32 34 H64 M32 46 H64 M32 58 H64" stroke="#a855f7" stroke-width="1.5"/>
        <circle cx="40" cy="46" r="4.5" fill="#f7d996"/>
        <path d="M44 46 V29 L58 27 V42" fill="none" stroke="#f7d996" stroke-width="2.2"/>
        <circle cx="54" cy="42" r="4.5" fill="#f7d996"/>`;
    case 'peta_rumah_adat':
      return `
        <polygon points="18,26 38,20 58,26 78,20 78,70 58,76 38,70 18,76" fill="#fef3c7" stroke="#c084fc" stroke-width="2"/>
        <path d="M38 20 V70 M58 26 V76" stroke="#d97706" stroke-width="1.4"/>
        <polygon points="48,34 60,46 36,46" fill="#7c2d12"/>
        <rect x="40" y="46" width="16" height="14" fill="#92400e"/>`;
    case 'teknik_tenun':
      return `
        <rect x="22" y="22" width="52" height="52" rx="4" fill="#1e1b4b" stroke="#f7d996" stroke-width="2"/>
        <path d="M30 22 V74 M42 22 V74 M54 22 V74 M66 22 V74" stroke="#e9d5ff" stroke-width="2"/>
        <path d="M18 40 H78 M18 56 H78" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>`;
    case 'resep_masakan_lost':
      return `
        <rect x="24" y="20" width="48" height="56" rx="5" fill="#311042" stroke="#f7d996" stroke-width="2.2"/>
        <ellipse cx="48" cy="44" rx="14" ry="8" fill="#b45309" stroke="#fde68a" stroke-width="1.5"/>
        <path d="M40 31 C40 26, 44 26, 44 31 M52 31 C52 26, 56 26, 56 31" stroke="#34d399" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M34 60 H62 M34 67 H54" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round"/>`;
    case 'permainan_tradisional_lost':
      return `
        <rect x="20" y="22" width="56" height="52" rx="6" fill="#3b0764" stroke="#f7d996" stroke-width="2.2"/>
        <circle cx="34" cy="42" r="5" fill="#34d399"/>
        <circle cx="48" cy="42" r="5" fill="#facc15"/>
        <circle cx="62" cy="42" r="5" fill="#38bdf8"/>
        <path d="M30 58 H66" stroke="#e9d5ff" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'upacara_adat':
      return `
        <polygon points="48,18 68,60 28,60" fill="#581c87" stroke="#f7d996" stroke-width="2.2"/>
        <path d="M24 62 H72 L66 74 H30 Z" fill="#7c2d12" stroke="#fde68a" stroke-width="2"/>
        <circle cx="48" cy="42" r="6" fill="#fde68a"/>`;
    case 'seni_ukir_lost':
      return `
        <rect x="22" y="22" width="52" height="52" rx="6" fill="#312e81" stroke="#c084fc" stroke-width="2.2"/>
        <path d="M48 64 C36 60 32 46 40 36 C46 28 56 36 48 46" fill="none" stroke="#f7d996" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M58 62 L70 36" stroke="#cbd5e1" stroke-width="3.2" stroke-linecap="round"/>`;
    case 'filosofi_batik':
      return `
        <rect x="22" y="20" width="52" height="56" rx="6" fill="#2e1065" stroke="#f7d996" stroke-width="2.2"/>
        <circle cx="48" cy="44" r="14" fill="none" stroke="#fde68a" stroke-width="2"/>
        <circle cx="48" cy="44" r="6" fill="#f59e0b"/>
        <path d="M48 26 V62 M30 44 H66" stroke="#c084fc" stroke-width="1.5"/>
        <path d="M32 66 H64" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round"/>`;
    case 'nusantara_record':
      return `
        <rect x="22" y="20" width="52" height="56" rx="6" fill="#311042" stroke="#f7d996" stroke-width="2.2"/>
        <circle cx="48" cy="42" r="12" fill="none" stroke="#34d399" stroke-width="2"/>
        <path d="M48 28 V56 M34 42 H62" stroke="#f7d996" stroke-width="1.6"/>
        <path d="M32 64 H64" stroke="#c084fc" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'identity_crystal':
      return `
        <polygon points="48,12 68,36 58,82 38,82 28,36" fill="#7e22ce" stroke="#e9d5ff" stroke-width="2.2"/>
        <polygon points="48,22 58,40 48,70 38,40" fill="#c084fc"/>
        <circle cx="48" cy="42" r="5" fill="#f7d996"/>`;

    // LEGACY / WORKSHOP SUPPORT KEYS
    case 'gamelan':
      return `
        <path d="M18 24 H78 M22 24 V74 M74 24 V74" stroke="#991b1b" stroke-width="4" stroke-linecap="round"/>
        <circle cx="48" cy="50" r="21" fill="#b45309" stroke="#f7d996" stroke-width="2.6"/>
        <circle cx="48" cy="50" r="13" fill="#d97706" stroke="#fef08a" stroke-width="1.5"/>
        <circle cx="48" cy="50" r="6" fill="#fde68a" stroke="#78350f" stroke-width="1.6"/>`;
    case 'resep_rendang':
      return `
        <ellipse cx="48" cy="60" rx="28" ry="14" fill="#1e293b" stroke="#f7d996" stroke-width="2.2"/>
        <ellipse cx="48" cy="56" rx="22" ry="9" fill="#7c2d12"/>
        <circle cx="42" cy="54" r="5" fill="#9a3412" stroke="#fdba74" stroke-width="1"/>
        <circle cx="53" cy="55" r="5" fill="#78350f" stroke="#fdba74" stroke-width="1"/>
        <circle cx="48" cy="50" r="4.5" fill="#991b1b" stroke="#fde68a" stroke-width="1"/>`;
    case 'fashion_mag':
      return `
        <rect x="24" y="18" width="48" height="60" rx="5" fill="#1e1b4b" stroke="#7dd3fc" stroke-width="2.2"/>
        <rect x="30" y="24" width="36" height="8" rx="2" fill="#38bdf8"/>
        <path d="M48 38 L58 66 H38 Z" fill="#f472b6" stroke="#fbcfe8" stroke-width="1.5"/>
        <circle cx="48" cy="40" r="4.5" fill="#fef3c7"/>`;
    case 'contemporary_cuisine':
      return `
        <path d="M22 52 H74 L66 74 H30 Z" fill="#fef3c7" stroke="#e5b869" stroke-width="2.2"/>
        <ellipse cx="48" cy="48" rx="24" ry="8" fill="#7c2d12" stroke="#f7d996" stroke-width="1.6"/>
        <circle cx="48" cy="45" r="7" fill="#b45309" stroke="#fde68a" stroke-width="1.4"/>`;
    default:
      return `
        <circle cx="48" cy="48" r="24" fill="#2e1065" stroke="#f7d996" stroke-width="2.4"/>
        <path d="M48 22 L53 43 L74 48 L53 53 L48 74 L43 53 L22 48 L43 43 Z" fill="#fef3c7"/>`;
  }
}

export function renderLockedRelicSvg(category: RelicCategory, artKey?: string): string {
  const palette = CATEGORY_GLOW[category] || CATEGORY_GLOW.local;
  const silhouetteGroup = artKey
    ? `<g opacity="0.24" style="filter: brightness(0) saturate(0) drop-shadow(0 0 2px ${palette.primary});">${getRelicInnerSvg(
        artKey
      )}</g>`
    : `<path d="M48 20 L54 38 L72 44 L54 50 L48 68 L42 50 L24 44 L42 38 Z" fill="#0f172a" stroke="${palette.primary}" stroke-opacity="0.45" stroke-width="1.6"/>`;

  return `<svg viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="Artefak belum ditemukan">
    <defs>
      <radialGradient id="lockGrad_${category}" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="${palette.primary}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#070b18" stop-opacity="0.95"/>
      </radialGradient>
    </defs>
    <rect x="6" y="6" width="84" height="84" rx="18" fill="url(#lockGrad_${category})" stroke="${palette.primary}" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="4 4"/>
    ${silhouetteGroup}
    <text x="48" y="56" text-anchor="middle" fill="${palette.primary}" font-family="Cinzel, serif" font-size="22" font-weight="800" opacity="0.88">?</text>
  </svg>`;
}

export function renderRelicSvg(artKey: string, category: RelicCategory = 'local', size = 96): string {
  const palette = CATEGORY_GLOW[category] || CATEGORY_GLOW.local;
  const inner = getRelicInnerSvg(artKey);

  return `<svg viewBox="0 0 96 96" width="${size}" height="${size}" role="img" aria-label="Ilustrasi ${artKey}">
    <defs>
      <radialGradient id="glow_${artKey}" cx="50%" cy="48%" r="54%">
        <stop offset="0%" stop-color="${palette.primary}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#070b18" stop-opacity="0.94"/>
      </radialGradient>
    </defs>
    <rect x="4" y="4" width="88" height="88" rx="18" fill="url(#glow_${artKey})" stroke="${palette.secondary}" stroke-opacity="0.55" stroke-width="1.6"/>
    ${inner}
  </svg>`;
}
