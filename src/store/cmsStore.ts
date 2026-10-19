import { create } from 'zustand';
import type { CmsPanelState, HotelSelectionState } from '../types';

export const useCmsPanelStore = create<CmsPanelState>((set) => ({
  isOpen: false,
  activeSection: null,

  toggle: () => set((state) => ({ isOpen: !state.isOpen, activeSection: null })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, activeSection: null }),
  setActiveSection: (section) => set({ activeSection: section }),
}));

export const useHotelSelectionStore = create<HotelSelectionState>((set) => ({
  selectedHotelId: localStorage.getItem('selected_hotel_id'),

  setSelectedHotelId: (id) => {
    if (id) {
      localStorage.setItem('selected_hotel_id', id);
    } else {
      localStorage.removeItem('selected_hotel_id');
    }
    set({ selectedHotelId: id });
  },
}));
