import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface OtherProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface MessageRow {
  id: string;
  sender_id: string | null;
  content: string;
  created_at: string | null;
}

const AVATAR_PALETTE = [
  "bg-aqua text-aqua-foreground",
  "bg-citron text-citron-foreground",
  "bg-vermillion text-vermillion-foreground",
  "bg-warm text-warm-foreground",
];

function avatarClasses(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface MessageThreadProps {
  userId: string;
  matchId: string;
  eventId: string | null;
  eventName: string | null;
  other: OtherProfile;
  onBack: () => void;
}

export default function MessageThread({ userId, matchId, eventId, eventName, other, onBack }: MessageThreadProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Couldn't load this conversation — try again.");
      setLoading(false);
      return;
    }
    setMessages((data as MessageRow[]) ?? []);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: userId,
      recipient_id: other.id,
      event_id: eventId,
      content,
    });

    setSending(false);
    if (error) {
      toast.error("Couldn't send — try again.");
      return;
    }
    setText("");
    await loadMessages();
  };

  return (
    <div className="fixed inset-0 z-50 bg-aqua flex flex-col">
      <header className="bg-card/95 border-b-2 border-primary flex items-center gap-3 px-4 py-3 shrink-0">
        <button onClick={onBack} className="ooo-border bg-card p-2 shrink-0" aria-label="Back to conversations">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar className="h-10 w-10 border-2 border-primary shrink-0">
          {other.avatar_url && <AvatarImage src={other.avatar_url} alt={other.full_name ?? "Profile photo"} />}
          <AvatarFallback className={`font-label text-xs ${avatarClasses(other.id)}`}>
            {initials(other.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-bold normal-case font-sans truncate">{other.full_name ?? "Member"}</p>
          <p className="text-[11px] text-muted-foreground normal-case font-sans truncate">
            {eventName ?? "General"}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground normal-case font-sans text-center mt-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground normal-case font-sans text-center mt-8">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ooo-border px-4 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                  <p className="text-sm normal-case font-sans break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 normal-case font-sans ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t-2 border-primary bg-card p-3 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            className="flex-1 ooo-border bg-card px-4 py-3 normal-case font-sans"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !text.trim()} size="icon" aria-label="Send message">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
