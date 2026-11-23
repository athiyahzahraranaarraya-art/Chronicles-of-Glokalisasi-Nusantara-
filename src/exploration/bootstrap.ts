import { CosmicExplorationController, type HostGameBridge } from './ui';
import type { HeroId, PlanetId } from './types';

interface HostHeroEntry {
  id: string;
  name: string;
  role: string;
  portraitSrc: string;
  color: string;
}

interface HostCodexEntry {
  term: string;
  origin: string;
  summary: string;
}

interface HostGlokalisasiApi {
  HEROES: Record<string, HostHeroEntry>;
  CODEX_ENTRIES?: HostCodexEntry[];
  getSelectedHeroId?: () => HeroId;
  selectHero?: (heroId: string, silent?: boolean) => void;
  getJades?: () => number;
  addJades?: (delta: number) => void;
  spendJades?: (amount: number) => boolean;
  playSfx?: (kind: string) => void;
}

declare global {
  interface Window {
    GlokalisasiGame?: HostGlokalisasiApi;
    CosmicExploration?: {
      open: (planetId?: PlanetId) => void;
      close: () => void;
      openCodex: () => void;
      openWorkshop: () => void;
      controller: CosmicExplorationController;
    };
  }
}

function createHostBridge(): HostGameBridge {
  return {
    getHeroId: (): HeroId => {
      const id = window.GlokalisasiGame?.getSelectedHeroId?.() || 'sparxie';
      if (id === 'sparkle' || id === 'sampo' || id === 'nihilux' || id === 'sparxie') {
        return id;
      }
      return 'sparxie';
    },
    setHeroId: (heroId: HeroId) => {
      window.GlokalisasiGame?.selectHero?.(heroId);
    },
    getHeroInfo: (heroId: HeroId) => {
      const entry = window.GlokalisasiGame?.HEROES?.[heroId];
      if (entry) {
        return {
          name: entry.name,
          role: entry.role,
          portraitSrc: entry.portraitSrc,
          color: entry.color,
        };
      }
      return {
        name: 'Sparxie',
        role: 'Penjaga Nusantara',
        portraitSrc: '/assets/aistudio/818876d9cc3d218ab167a4821ec388b0_718446f6.jpg',
        color: '#f7d996',
      };
    },
    getJades: () => window.GlokalisasiGame?.getJades?.() ?? 0,
    addJades: (delta: number) => {
      window.GlokalisasiGame?.addJades?.(delta);
    },
    spendJades: (amount: number) => {
      return window.GlokalisasiGame?.spendJades?.(amount) ?? false;
    },
    playSfx: (kind: string) => {
      window.GlokalisasiGame?.playSfx?.(kind);
    },
    getTheoryCodex: () => window.GlokalisasiGame?.CODEX_ENTRIES || [],
  };
}

function mountExplorationBindings() {
  const controller = new CosmicExplorationController(createHostBridge());

  window.CosmicExploration = {
    open: (planetId?: PlanetId) => controller.openExploration(planetId),
    close: () => controller.closeExploration(),
    openCodex: () => controller.openAstralCodex(),
    openWorkshop: () => controller.openWorkshop(),
    controller,
  };

  const bindOpen = (elId: string) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener('click', (evt) => {
      if (evt.currentTarget && typeof (evt.currentTarget as HTMLButtonElement).blur === 'function') {
        (evt.currentTarget as HTMLButtonElement).blur();
      }
      window.GlokalisasiGame?.playSfx?.('click');
      controller.openExploration();
    });
  };

  bindOpen('btn-title-explore');
  bindOpen('btn-hud-explore');
  bindOpen('btn-map-explore');

  document.getElementById('btn-hud-astral-codex')?.addEventListener('click', (evt) => {
    if (evt.currentTarget && typeof (evt.currentTarget as HTMLButtonElement).blur === 'function') {
      (evt.currentTarget as HTMLButtonElement).blur();
    }
    window.GlokalisasiGame?.playSfx?.('click');
    controller.openAstralCodex();
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('explore') === '1') {
    controller.openExploration();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountExplorationBindings);
} else {
  mountExplorationBindings();
}
