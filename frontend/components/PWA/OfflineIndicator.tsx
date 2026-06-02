import React from "react";
import { usePWA } from "@/hooks/usePWA";

export function OfflineIndicator() {
  const { isOnline, isSyncing } = usePWA();

  if (isOnline && !isSyncing) {
    return null;
  }

  return (
    <div
      className={`offline-indicator ${isSyncing ? "syncing" : "offline"}`}
      role="status"
      aria-live="polite"
      aria-label={isSyncing ? "Syncing offline changes" : "Offline mode"}
    >
      <span className="indicator-icon">
        {isSyncing ? "⟳" : "⚠"}
      </span>
      <span className="indicator-text">
        {isSyncing ? "Syncing changes..." : "Offline - Your changes will sync when connected"}
      </span>
    </div>
  );
}

import styled from "styled-jsx";

const styles = styled.jsx`
  .offline-indicator {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 20px;
    background: #f59e0b;
    color: white;
    font-size: 14px;
    font-weight: 500;
    z-index: 999;
    animation: slideUp 0.3s ease-out;
  }

  .offline-indicator.offline {
    background: #ef4444;
  }

  .offline-indicator.syncing {
    background: #3b82f6;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .indicator-icon {
    font-size: 18px;
  }

  .offline-indicator.syncing .indicator-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .indicator-text {
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .offline-indicator {
      font-size: 13px;
      padding: 10px 16px;
    }

    .indicator-text {
      white-space: normal;
    }
  }
`;
