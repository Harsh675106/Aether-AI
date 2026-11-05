import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Globe,
  X,
  Minimize2,
  Maximize2,
  ExternalLink,
  EyeOff,
  Eye,
} from 'lucide-react';
import { useBrowserStore } from '@/stores/browserStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateUrl(url: string, maxLen = 30): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    return display.length > maxLen ? display.slice(0, maxLen) + '…' : display;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '…' : url;
  }
}

// ── Shared pill wrapper ───────────────────────────────────────────────────────

interface PillProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: boolean;
}

function Pill({ children, className = '', onClick, glow }: PillProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none',
        'bg-[rgba(5,10,20,0.75)] border border-sky-400/30 backdrop-blur-xl',
        'rounded-[2rem] transition-all duration-200',
        glow
          ? 'shadow-[0_0_30px_rgba(56,189,248,0.4)]'
          : 'shadow-[0_0_30px_rgba(56,189,248,0.2)]',
        'hover:border-sky-400/60 hover:bg-sky-500/20',
        'hover:shadow-[0_0_30px_rgba(56,189,248,0.4)]',
        className,
      ].join(' ')}
    >
      {children}
    </motion.div>
  );
}

// ── Icon button ───────────────────────────────────────────────────────────────

interface IconBtnProps {
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}

function IconBtn({ icon: Icon, label, onClick, danger = false }: IconBtnProps) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={[
        'p-1.5 rounded-xl transition-all duration-150',
        danger
          ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300'
          : 'text-slate-400 hover:bg-sky-500/20 hover:text-sky-300',
      ].join(' ')}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}

// ── States ────────────────────────────────────────────────────────────────────

function ClosedPill({ onOpen }: { onOpen: () => void }) {
  return (
    <Pill onClick={onOpen}>
      <Globe size={16} strokeWidth={2} className="text-sky-300 shrink-0" />
      <span className="text-sm font-medium text-slate-100 whitespace-nowrap">
        Open Browser
      </span>
    </Pill>
  );
}

interface OpenPillProps {
  url: string;
  onHide: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFloat: () => void;
  onClose: () => void;
}

function OpenPill({ url, onHide, onMinimize, onMaximize, onFloat, onClose }: OpenPillProps) {
  return (
    <Pill glow>
      {/* URL display */}
      <Globe size={15} strokeWidth={2} className="text-sky-300 shrink-0" />
      <span
        className="text-xs font-mono text-slate-300 max-w-[180px] truncate"
        title={url}
      >
        {truncateUrl(url)}
      </span>

      {/* Divider */}
      <span className="w-px h-4 bg-slate-700 mx-0.5 shrink-0" />

      {/* Controls */}
      <div className="flex items-center gap-0.5">
        <IconBtn icon={EyeOff} label="Hide browser" onClick={(e) => { e.stopPropagation(); onHide(); }} />
        <IconBtn icon={Minimize2} label="Minimize browser" onClick={(e) => { e.stopPropagation(); onMinimize(); }} />
        <IconBtn icon={Maximize2} label="Maximize browser" onClick={(e) => { e.stopPropagation(); onMaximize(); }} />
        <IconBtn icon={ExternalLink} label="Float browser" onClick={(e) => { e.stopPropagation(); onFloat(); }} />
        <IconBtn icon={X} label="Close browser" onClick={(e) => { e.stopPropagation(); onClose(); }} danger />
      </div>
    </Pill>
  );
}

function HiddenPill({ onRestore }: { onRestore: () => void }) {
  return (
    <Pill onClick={onRestore} glow>
      {/* Pulsing status dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400" />
      </span>
      <span className="text-sm font-medium text-slate-300 whitespace-nowrap">
        Browser Running
      </span>
      <Eye size={14} strokeWidth={2} className="text-sky-400 ml-1 shrink-0" />
    </Pill>
  );
}

// ── Main BrowserLauncher ──────────────────────────────────────────────────────

export function BrowserLauncher() {
  const {
    state,
    openBrowser,
    showBrowser,
    hideBrowser,
    minimizeBrowser,
    maximizeBrowser,
    closeBrowser,
    setLayout,
    lastUrl,
  } = useBrowserStore();

  const { isOpen, isVisible, currentUrl } = state;

  const handleOpen = () => {
    openBrowser(lastUrl);
  };

  const handleFloat = () => {
    setLayout('floating');
  };

  return (
    <div className="fixed bottom-20 right-6 z-50">
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.div key="closed">
            <ClosedPill onOpen={handleOpen} />
          </motion.div>
        )}

        {isOpen && isVisible && (
          <motion.div key="open">
            <OpenPill
              url={currentUrl}
              onHide={hideBrowser}
              onMinimize={minimizeBrowser}
              onMaximize={maximizeBrowser}
              onFloat={handleFloat}
              onClose={closeBrowser}
            />
          </motion.div>
        )}

        {isOpen && !isVisible && (
          <motion.div key="hidden">
            <HiddenPill onRestore={showBrowser} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
