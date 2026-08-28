// src/components/UpdateNotifier.jsx
// Meregistrasi service worker PWA. Dapatkan versi terbaru dengan reload otomatis
// ketika Service Worker baru terdeteksi.
import { useRegisterSW } from "virtual:pwa-register/react";

function UpdateNotifier() {
  useRegisterSW({
    onRegisteredRefresh() {
      window.location.reload();
    },
    onNeedRefresh() {
      window.location.reload();
    },
  });

  return null;
}

export default UpdateNotifier;
