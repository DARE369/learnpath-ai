import { useEffect, useState, useRef } from "react";

interface PWAState {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isSyncing: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isInstallable: false,
    isInstalled: false,
    isSyncing: false,
    deferredPrompt: null,
  });

  const syncQueueRef = useRef<{
    quizResponses: any[];
    videoProgress: any[];
    notes: any[];
  }>({
    quizResponses: [],
    videoProgress: [],
    notes: [],
  });

  // Register service worker and set up event listeners
  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("Service Worker registered:", registration);

          // Listen for controller change
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            console.log("Service Worker controller changed");
          });
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }

    // Listen for online/offline events
    const handleOnline = () => {
      console.log("Online!");
      setState((prev) => ({ ...prev, isOnline: true }));
      syncOfflineChanges();
    };

    const handleOffline = () => {
      console.log("Offline!");
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      setState((prev) => ({
        ...prev,
        isInstallable: true,
        deferredPrompt: prompt,
      }));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log("App installed!");
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
        deferredPrompt: null,
      }));
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // Check if app is already installed
    if ("getInstalledRelatedApps" in navigator) {
      (navigator as any).getInstalledRelatedApps().then((apps: any[]) => {
        if (apps.length > 0) {
          setState((prev) => ({ ...prev, isInstalled: true }));
        }
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  /**
   * Request install prompt
   */
  const installApp = async () => {
    if (!state.deferredPrompt) {
      console.error("Install prompt not available");
      return;
    }

    state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted install prompt");
      setState((prev) => ({
        ...prev,
        isInstallable: false,
        deferredPrompt: null,
      }));
    }
  };

  /**
   * Add item to offline sync queue
   */
  const queueOfflineChange = (
    type: "quizResponse" | "videoProgress" | "note",
    data: any
  ) => {
    if (state.isOnline) {
      // If online, no need to queue
      return;
    }

    if (type === "quizResponse") {
      syncQueueRef.current.quizResponses.push(data);
      localStorage.setItem(
        "learnpath_sync_queue_quiz",
        JSON.stringify(syncQueueRef.current.quizResponses)
      );
    } else if (type === "videoProgress") {
      syncQueueRef.current.videoProgress.push(data);
      localStorage.setItem(
        "learnpath_sync_queue_video",
        JSON.stringify(syncQueueRef.current.videoProgress)
      );
    } else if (type === "note") {
      syncQueueRef.current.notes.push(data);
      localStorage.setItem(
        "learnpath_sync_queue_notes",
        JSON.stringify(syncQueueRef.current.notes)
      );
    }

    console.log("Queued offline change:", type, data);
  };

  /**
   * Sync offline changes when back online
   */
  const syncOfflineChanges = async () => {
    if (!state.isOnline) {
      console.log("Cannot sync: still offline");
      return;
    }

    setState((prev) => ({ ...prev, isSyncing: true }));

    try {
      // Load queued items from localStorage
      const quizQueue = JSON.parse(
        localStorage.getItem("learnpath_sync_queue_quiz") || "[]"
      );
      const videoQueue = JSON.parse(
        localStorage.getItem("learnpath_sync_queue_video") || "[]"
      );
      const noteQueue = JSON.parse(
        localStorage.getItem("learnpath_sync_queue_notes") || "[]"
      );

      // Sync quiz responses
      for (const response of quizQueue) {
        try {
          const res = await fetch("/api/quiz/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });

          if (res.ok) {
            console.log("Synced quiz response:", response.id);
          }
        } catch (error) {
          console.error("Failed to sync quiz response:", error);
        }
      }

      // Sync video progress
      for (const progress of videoQueue) {
        try {
          const res = await fetch(
            `/api/learning/progress/${progress.video_id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                current_time: progress.current_time,
                total_duration: progress.total_duration,
              }),
            }
          );

          if (res.ok) {
            console.log("Synced video progress:", progress.video_id);
          }
        } catch (error) {
          console.error("Failed to sync video progress:", error);
        }
      }

      // Sync notes
      for (const note of noteQueue) {
        try {
          const res = await fetch("/api/learning/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(note),
          });

          if (res.ok) {
            console.log("Synced note:", note.id);
          }
        } catch (error) {
          console.error("Failed to sync note:", error);
        }
      }

      // Clear sync queues
      localStorage.removeItem("learnpath_sync_queue_quiz");
      localStorage.removeItem("learnpath_sync_queue_video");
      localStorage.removeItem("learnpath_sync_queue_notes");

      console.log("Offline sync completed");
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setState((prev) => ({ ...prev, isSyncing: false }));
    }
  };

  /**
   * Request background sync (if Periodic Background Sync API available)
   */
  const requestPeriodicSync = async (tag: string, minInterval: number) => {
    if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        (registration as any).sync.register(tag);
        console.log("Periodic sync requested:", tag);
      } catch (error) {
        console.error("Periodic sync request failed:", error);
      }
    }
  };

  /**
   * Request notification permission
   */
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      console.log("Notifications not supported");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  };

  /**
   * Send local notification
   */
  const sendNotification = (title: string, options?: NotificationOptions) => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        options,
      });
    } else if ("Notification" in window) {
      new Notification(title, options);
    }
  };

  return {
    // State
    isOnline: state.isOnline,
    isInstallable: state.isInstallable,
    isInstalled: state.isInstalled,
    isSyncing: state.isSyncing,

    // Methods
    installApp,
    queueOfflineChange,
    syncOfflineChanges,
    requestPeriodicSync,
    requestNotificationPermission,
    sendNotification,
  };
}
