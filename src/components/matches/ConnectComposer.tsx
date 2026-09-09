import { useState } from "react";
import { Loader2, X } from "lucide-react";
import OffripButton from "@/components/offrip/Button";

// The editable connect-message box, shared by MatchesTab's "Message" action and
// FullProfileView's "Make the Intro". `defaultMessage` seeds the textarea; the
// caller owns the send flow and passes the edited text back through `onSend`.
export default function ConnectComposer({
  defaultMessage,
  sending,
  onSend,
  onCancel,
}: {
  defaultMessage: string;
  sending: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(defaultMessage);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-offrip-body text-xs text-offrip-medium-gray">This one's just a starting point</span>
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          aria-label="Cancel"
          className="shrink-0 text-offrip-medium-gray hover:text-offrip-black disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <textarea
        className="w-full border border-offrip-black/20 bg-offrip-white px-3 py-2 font-offrip-body text-sm outline-none focus:border-offrip-black resize-none"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={sending}
        autoFocus
      />
      <OffripButton className="w-full" disabled={sending || !text.trim()} onClick={() => onSend(text)}>
        {sending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        {sending ? "Sending…" : "Send"}
      </OffripButton>
    </div>
  );
}
