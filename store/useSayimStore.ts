import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SayimState {
  stockData: any[];
  counts: Record<string, string>;
  notes: Record<string, string>;
  waste: Record<string, string>;
  skt: Record<string, string>;
  units: Record<string, string>;

  setStockData: (data: any[]) => void;
  addStockItem: (newItem: any) => void; // YENİ: Sıfırdan ürün ekle
  updateStockItemBarcode: (stokName: string, newBarcode: string) => void; // YENİ: Mevcut ürüne barkod ata
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
      stockData: [],
      counts: {},
      notes: {},
      waste: {},
      skt: {},
      units: {},

      setStockData: (data) => set({ stockData: data }),

      addStockItem: (newItem) => set((state) => ({
        stockData: [newItem, ...state.stockData]
      })),

      updateStockItemBarcode: (stokName, newBarcode) => set((state) => ({
        stockData: state.stockData.map(item =>
          item.Stok === stokName ? { ...item, Barkod: newBarcode } : item
        )
      })),

      updateCount: (key, value) => set((state) => ({ counts: { ...state.counts, [key]: value } })),
      updateWaste: (key, value) => set((state) => ({ waste: { ...state.waste, [key]: value } })),
      updateSkt: (key, value) => set((state) => ({ skt: { ...state.skt, [key]: value } })),
      updateNote: (key, value) => set((state) => ({ notes: { ...state.notes, [key]: value } })),
      updateUnit: (key, value) => set((state) => ({ units: { ...state.units, [key]: value } })),
      clearAll: () => set({ counts: {}, notes: {}, waste: {}, skt: {}, units: {} }),
    }),
    {
      name: 'sayim-storage',
    }
  )
);