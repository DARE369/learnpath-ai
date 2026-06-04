import React, { useState } from "react";
import { Smartphone } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [showPrompt, setShowPrompt] = useState(true);

  if (!isInstallable || !showPrompt) {
    return null;
  }

  return (
    <div className="pwa-install-prompt" role="dialog" aria-labelledby="install-title">
      <div className="prompt-content">
        <div className="prompt-icon"><Smartphone size={36} /></div>
        <div className="prompt-text">
          <h3 id="install-title">Install LearnPath</h3>
          <p>Add to your home screen for quick access and offline capabilities</p>
        </div>
      </div>

      <div className="prompt-actions">
        <button
          className="btn-install"
          onClick={async () => {
            await installApp();
            setShowPrompt(false);
          }}
          aria-label="Install LearnPath app"
        >
          Install
        </button>
        <button
          className="btn-dismiss"
          onClick={() => setShowPrompt(false)}
          aria-label="Dismiss install prompt"
        >
          Not now
        </button>
      </div>

      <style jsx>{`
        .pwa-install-prompt {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          max-width: 400px;
          z-index: 1000;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(400px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .prompt-content {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }

        .prompt-icon {
          font-size: 40px;
          flex-shrink: 0;
        }

        .prompt-text h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #1f2937;
        }

        .prompt-text p {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.4;
        }

        .prompt-actions {
          display: flex;
          gap: 8px;
        }

        button {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-install {
          background: #3b82f6;
          color: white;
        }

        .btn-install:hover {
          background: #2563eb;
        }

        .btn-install:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .btn-dismiss {
          background: #f3f4f6;
          color: #1f2937;
        }

        .btn-dismiss:hover {
          background: #e5e7eb;
        }

        .btn-dismiss:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        @media (max-width: 640px) {
          .pwa-install-prompt {
            bottom: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}
