import { create } from "zustand";

interface CommandState {
  history: string[];
  draft: string;
  setDraft: (draft: string) => void;
  submit: () => void;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  history: [],
  draft: "",
  setDraft: (draft) => set({ draft }),
  submit: () => {
    const command = get().draft.trim();
    if (!command) {
      return;
    }

    set((state) => ({
      history: [command, ...state.history].slice(0, 20),
      draft: "",
    }));
  },
}));

