import { create } from "zustand";

interface SidebarStore {
  isCollapsed: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}

export const useSidebar = create<SidebarStore>((set) => ({
  isCollapsed: false,
  onOpen: () => set({ isCollapsed: false }),
  onClose: () => set({ isCollapsed: true }),
  onToggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
}));
