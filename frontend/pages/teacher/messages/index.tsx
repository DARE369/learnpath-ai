import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  MessageSquare,
  Megaphone,
  Plus,
  Search,
  ChevronRight,
  Users,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton, EmptyState } from "../../../components/ui";

interface ConversationItem {
  conversation_id: string;
  name: string;
  type: "direct" | "group";
  participant_count: number;
  last_message: string;
  last_message_time: string | null;
  unread_count: number;
}

interface AnnouncementItem {
  announcement_id: string;
  title: string;
  sent_at: string | null;
  read_count: number;
  total_recipients: number;
}

interface InboxData {
  conversations: ConversationItem[];
  announcements: AnnouncementItem[];
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "direct", label: "1-on-1" },
  { value: "group", label: "Groups" },
  { value: "announcements", label: "Announcements" },
];

export default function MessagesInboxPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter_type: filter });
      if (search) params.set("search", search);
      const res = await fetch(`/api/messaging/inbox?${params}`, { headers: auth });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData({ conversations: [], announcements: [] });
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  function fmtTime(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <>
      <Head><title>Messages — LearnPath AI</title></Head>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Messages</h1>
            <p className="mt-0.5 text-sm text-white/40">Conversations with students and class announcements.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push("/teacher/announcements")}>
              <Megaphone className="mr-1.5 h-4 w-4" /> Announce
            </Button>
            <Button size="sm" onClick={() => router.push("/teacher/class/select?intent=message")}>
              <Plus className="mr-1.5 h-4 w-4" /> New message
            </Button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search by name or content…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  filter === opt.value
                    ? "bg-indigo-500 text-white"
                    : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : (
          <>
            {/* Conversations */}
            {filter !== "announcements" && (
              <section className="mb-6">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">
                  Conversations
                </h2>
                {!data?.conversations.length ? (
                  <EmptyState
                    icon={<MessageSquare className="h-5 w-5" />}
                    title="No conversations yet"
                    description="Start a new message to connect with a student."
                  />
                ) : (
                  <div className="space-y-2">
                    {data.conversations.map((conv) => (
                      <button
                        key={conv.conversation_id}
                        onClick={() => router.push(`/teacher/messages/${conv.conversation_id}`)}
                        className="w-full text-left"
                      >
                        <Card padding="md" interactive>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                              {conv.type === "group" ? (
                                <Users className="h-4 w-4" />
                              ) : (
                                <MessageSquare className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium text-white">{conv.name}</span>
                                <span className="shrink-0 text-xs text-white/30">
                                  {fmtTime(conv.last_message_time)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between gap-2">
                                <p className="truncate text-xs text-white/40">{conv.last_message || "No messages yet"}</p>
                                {conv.unread_count > 0 ? (
                                  <span className="shrink-0 rounded-full bg-indigo-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                                    {conv.unread_count}
                                  </span>
                                ) : (
                                  <CheckCheck className="h-3.5 w-3.5 shrink-0 text-white/20" />
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
                          </div>
                        </Card>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Announcements */}
            {filter !== "direct" && filter !== "group" && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">
                    Announcements Sent
                  </h2>
                  <button
                    onClick={() => router.push("/teacher/announcements")}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    View all
                  </button>
                </div>
                {!data?.announcements.length ? (
                  <EmptyState
                    icon={<Megaphone className="h-5 w-5" />}
                    title="No announcements yet"
                    description="Post a class-wide announcement to all students."
                  />
                ) : (
                  <div className="space-y-2">
                    {data.announcements.map((ann) => {
                      const readPct =
                        ann.total_recipients > 0
                          ? Math.round((ann.read_count / ann.total_recipients) * 100)
                          : 0;
                      const allRead = ann.read_count >= ann.total_recipients && ann.total_recipients > 0;
                      return (
                        <Card key={ann.announcement_id} padding="md">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-white">{ann.title}</p>
                              <p className="mt-0.5 text-xs text-white/40">{fmtTime(ann.sent_at)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-white">
                                {ann.read_count}/{ann.total_recipients}
                              </p>
                              <p className={`text-xs ${allRead ? "text-emerald-400" : "text-white/40"}`}>
                                {allRead ? "All read ✓✓" : `${readPct}% read`}
                              </p>
                            </div>
                          </div>
                          {!allRead && ann.total_recipients > 0 && (
                            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${readPct}%` }}
                              />
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
