import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Veri tiplerimizi tanımlıyoruz
interface SayimState {
  stockData: any[];
  counts: Record<string, string>;
  notes: Record<string, string>;
  waste: Record<string, string>;
  skt: Record<string, string>;
  units: Record<string, string>;

  // Aksiyonlar (Veriyi değiştirecek fonksiyonlar)
  setStockData: (data: any[]) => void;
  updateCount: (key: string, value: string) => void;
  updateWaste: (key: string, value: string) => void;
  updateSkt: (key: string, value: string) => void;
  updateNote: (key: string, value: string) => void;
  updateUnit: (key: string, value: string) => void;
  clearAll: () => void;
}

export const useSayimStore = create<SayimState>()(
  persist(
    (set) => ({
      // Başlangıç değerleri (Boş)
      stockData: [],
      counts: {},
      notes: {},
      waste: {},
      skt: {},
      units: {},

      // Güncelleme Fonksiyonları
      setStockData: (data) => set({ stockData: data }),
      updateCount: (key, value) => set((state) => ({ counts: { ...state.counts, [key]: value } })),
      updateWaste: (key, value) => set((state) => ({ waste: { ...state.waste, [key]: value } })),
      updateSkt: (key, value) => set((state) => ({ skt: { ...state.skt, [key]: value } })),
      updateNote: (key, value) => set((state) => ({ notes: { ...state.notes, [key]: value } })),
      updateUnit: (key, value) => set((state) => ({ units: { ...state.units, [key]: value } })),

      // Her şeyi sıfırlama (Çıkışta veya listeyi silerken)
      clearAll: () => set({ stockData: [], counts: {}, notes: {}, waste: {}, skt: {}, units: {} }),
    }),
    {
      name: 'longosphere_backup', // CTO Dokunuşu: Eski localStorage ismini koruduk, geçiş sorunsuz olacak!
    }
  )
);