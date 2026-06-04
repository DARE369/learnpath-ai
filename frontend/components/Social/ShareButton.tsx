import React, { useState } from "react";

function authHeaders(json = false): Record<string, string> {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
      : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h["Content-Type"] = "application/json";
  return h;
}

interface Buddy { user_id: string; name: string; }

export default function ShareButton({ itemType, itemRef, title }: {
  itemType: "note" | "upload";
  itemRef: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [buddies, setBuddies] = useState<Buddy[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    setMsg(null);
    if (next && buddies === null) {
      try {
        const res = await fetch("/api/buddies/", { headers: authHeaders() });
        const data = await res.json();
        setBuddies(data.buddies || []);
      } catch {
        setBuddies([]);
      }
    }
  };

  const share = async (b: Buddy) => {
    try {
      const res = await fetch("/api/buddies/share", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ recipient_id: b.user_id, item_type: itemType, item_ref: itemRef, title }),
      });
      setMsg(res.ok ? `Shared with ${b.name}` : "Could not share");
    } catch {
      setMsg("Could not share");
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={toggle}
        className="px-4 py-2 bg-surface border border-border rounded-lg text-white/70 hover:text-white text-sm"
      >
        🔗 Share
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-[#1c1c1c] border border-white/10 rounded-xl shadow-2xl z-50 p-2">
          {buddies === null ? (
            <p className="text-white/40 text-xs px-2 py-2">Loading…</p>
          ) : buddies.length === 0 ? (
            <p className="text-white/40 text-xs px-2 py-2">No buddies yet — add some on the Buddies page.</p>
          ) : msg ? (
            <p className="text-white/70 text-xs px-2 py-2">{msg}</p>
          ) : (
            buddies.map((b) => (
              <button key={b.user_id} onClick={() => share(b)}
                      className="block w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">
                {b.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
