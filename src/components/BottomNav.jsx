// src/components/BottomNav.jsx
// Bottom navigation bar — Shopee-style, mobile only (lg:hidden).

import React, { useState, useEffect, useRef } from "react";
import {
  HomeIcon,
  WrenchIcon,
  Squares2X2Icon,
  UserIcon,
  NewspaperIcon,
  SwatchIcon,
  HomeModernIcon,
  CameraIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeSolid,
  WrenchIcon as WrenchSolid,
  Squares2X2Icon as Squares2X2Solid,
  UserIcon as UserSolid,
  NewspaperIcon as NewspaperSolid,
  SwatchIcon as SwatchSolid,
  HomeModernIcon as HomeModernSolid,
  CameraIcon as CameraSolid,
  DocumentTextIcon as DocumentTextSolid,
  ShieldCheckIcon as ShieldCheckSolid,
  ArrowUturnLeftIcon as ArrowUturnLeftSolid,
} from "@heroicons/react/24/solid";

function SprayPaintIcon({ active }) {
  return (
    <img
      src={active ? "/icons/spray-paint-solid.png" : "/icons/spray-paint-outline-black.png"}
      alt="Pilok"
      className="w-6 h-6"
    />
  );
}

/* ── Tab config ────────────────────────────────────── */
const tabs = [
  { label: "Beranda",  path: "/",          Icon: HomeIcon,      ActiveIcon: HomeSolid },
  { label: "Pilok",    path: "/pilok",     Icon: SprayPaintIcon, ActiveIcon: SprayPaintIcon },
  { label: "Onderdil", path: "/onderdil",  Icon: WrenchIcon,    ActiveIcon: WrenchSolid },
  { label: "Tips & Trik", path: "/blog", Icon: NewspaperIcon, ActiveIcon: NewspaperSolid },
];

const gridLinks = [
  { label: "Katalog Pilok", path: "/katalog-warna", Icon: SwatchIcon, ActiveIcon: SwatchSolid },
  { label: "Garasi Virtual", path: "/simulator", Icon: HomeModernIcon, ActiveIcon: HomeModernSolid },
  { label: "Scan Warna", path: "/scan-warna", Icon: CameraIcon, ActiveIcon: CameraSolid },
];

const legalLinks = [
  { label: "Syarat & Ketentuan", path: "/syarat-ketentuan", Icon: DocumentTextIcon, ActiveIcon: DocumentTextSolid },
  { label: "Kebijakan Privasi", path: "/kebijakan-privasi", Icon: ShieldCheckIcon, ActiveIcon: ShieldCheckSolid },
  { label: "Kebijakan Pengembalian", path: "/kebijakan-pengembalian", Icon: ArrowUturnLeftIcon, ActiveIcon: ArrowUturnLeftSolid },
];

/* ── BottomNav ─────────────────────────────────────── */
const BottomNav = () => {
  const [currentPath, setCurrentPath] = useState("/");
  const [showGridMenu, setShowGridMenu] = useState(false);
  const gridMenuRef = useRef(null);

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gridMenuRef.current && !gridMenuRef.current.contains(event.target)) {
        setShowGridMenu(false);
      }
    };

    if (showGridMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showGridMenu]);

  const isActive = (path) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const gridPaths = gridLinks.map((link) => link.path);
  const legalPaths = legalLinks.map((link) => link.path);
  const isGridActive =
    showGridMenu ||
    gridPaths.some((path) => isActive(path)) ||
    legalPaths.some((path) => isActive(path));

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <nav className="flex items-center justify-around h-16 px-1" aria-label="Navigasi bawah">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const IconComponent = active ? tab.ActiveIcon : tab.Icon;

          const colorClass = active ? "text-orange-500" : "text-slate-800";
          const classes = `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${colorClass}`;

          return (
            <a
              key={tab.label}
              href={tab.path}
              className={classes}
              aria-label={tab.label}
            >
              <IconComponent active={active} className="w-6 h-6" />
              <span className="text-[10px] font-semibold leading-tight">{tab.label}</span>
            </a>
          );
        })}

        {/* Grid Menu */}
        <div className="relative flex flex-col items-center justify-center flex-1 h-full" ref={gridMenuRef}>
          <button
            type="button"
            onClick={() => setShowGridMenu((prev) => !prev)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isGridActive ? "text-orange-500" : "text-slate-800"}`}
            aria-label="Menu lainnya"
          >
            {isGridActive ? <Squares2X2Solid className="w-6 h-6" /> : <Squares2X2Icon className="w-6 h-6" />}
            <span className="text-[10px] font-semibold leading-tight">Lainnya</span>
          </button>

          {showGridMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50">
              {gridLinks.map((link) => {
                const active = isActive(link.path);
                const IconComponent = active ? link.ActiveIcon : link.Icon;
                return (
                  <a
                    key={link.path}
                    href={link.path}
                    onClick={() => setShowGridMenu(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${active ? "text-orange-600 bg-orange-50" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <IconComponent className={`w-5 h-5 ${active ? "text-orange-500" : "text-slate-400"}`} />
                    {link.label}
                  </a>
                );
              })}

              {/* Grup Informasi (halaman legal) */}
              <div className="my-2 border-t border-slate-100"></div>
              <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Informasi
              </p>
              {legalLinks.map((link) => {
                const active = isActive(link.path);
                const IconComponent = active ? link.ActiveIcon : link.Icon;
                return (
                  <a
                    key={link.path}
                    href={link.path}
                    onClick={() => setShowGridMenu(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${active ? "text-orange-600 bg-orange-50" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <IconComponent className={`w-5 h-5 ${active ? "text-orange-500" : "text-slate-400"}`} />
                    {link.label}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Akun */}
        {(() => {
          const active = isActive("/akun");
          const IconComponent = active ? UserSolid : UserIcon;
          const colorClass = active ? "text-orange-500" : "text-slate-800";
          const classes = `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${colorClass}`;
          return (
            <a href="/akun" className={classes} aria-label="Akun">
              <IconComponent active={active} className="w-6 h-6" />
              <span className="text-[10px] font-semibold leading-tight">Akun</span>
            </a>
          );
        })()}
      </nav>
    </div>
  );
};

export default BottomNav;
