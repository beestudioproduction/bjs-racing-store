// src/components/PasswordStrengthMeter.jsx
// Indikator kekuatan kata sandi gaya profesional (Dropbox/GitHub):
// bar 4 segmen merah → oranye → lime → hijau + label + checklist syarat live.
import React from "react";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import {
  getPasswordChecks,
  getStrengthMeta,
  scorePassword,
} from "@/lib/passwordStrength.ts";

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const score = scorePassword(password);
  const meta = getStrengthMeta(score);
  const checks = getPasswordChecks(password);
  // Sandi non-kosong selalu menandai minimal satu segmen (merah).
  const filled = Math.max(score, 1);

  return (
    <div className="mt-2" aria-live="polite">
      {/* --- Bar segmen --- */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((segment) => (
            <div
              key={segment}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                segment <= filled ? meta.bar : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${meta.text}`}>
          {meta.label}
        </span>
      </div>

      {/* --- Checklist syarat live --- */}
      <ul className="mt-1.5 space-y-0.5">
        {checks.map((check) => (
          <li
            key={check.id}
            className={`flex items-center gap-1.5 text-xs ${
              check.passed ? "text-green-600" : "text-slate-400"
            }`}
          >
            {check.passed ? (
              <FiCheckCircle className="w-3 h-3 shrink-0" />
            ) : (
              <FiXCircle className="w-3 h-3 shrink-0" />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
