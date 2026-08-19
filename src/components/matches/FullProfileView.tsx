import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { fetchMatchDetail, type MatchDetailResult } from "@/lib/matchDetail";
import { buildFullProfileExplanation, type ClickPair } from "@/lib/matchExplanation";
import OffripButton from "@/components/offrip/Button";
import OffripCard from "@/components/offrip/Card";
import OffripChip from "@/components/offrip/Chip";

interface FullProfileViewProps {
  matchId: string;
  currentUserId: string;
  /** Optional for now -- Piece 8 wires the real "back to matches" navigation. Renders inert without it. */
  onBack?: () => void;
  /** Optional for now -- Piece 7 wires the real connect action. Renders inert without it. */
  onMakeIntro?: () => void;
}

const AVATAR_PALETTE = ["bg-offrip-aqua", "bg-offrip-lime", "bg-offrip-orange", "bg-offrip-blue"];

function avatarClasses(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function firstName(name: string | null) {
  const trimmed = (name ?? "").trim();
  return trimmed.split(/\s+/)[0] || "This person";
}

/** First sentence of the full summary, for the short intro callout -- the fuller "Why This Makes Sense" box below shows the whole thing, so this stays a genuine excerpt rather than a duplicate. */
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : text).trim();
}

function LoadingState() {
  return (
    <div className="bg-offrip-white p-8 text-center font-offrip-body text-offrip-black">
      <p className="text-offrip-medium-gray">Loading this match…</p>
    </div>
  );
}

function MessageState({ message, onBack }: { message: string; onBack?: () => void }) {
  return (
    <div className="bg-offrip-white p-8 text-center font-offrip-body text-offrip-black">
      <p className="text-offrip-medium-gray">{message}</p>
      {onBack && (
        <button
          onClick={onBack}
          className="mt-4 font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-black underline underline-offset-4"
        >
          ← Back to Matches
        </button>
      )}
    </div>
  );
}

function ExpertisePill({ children }: { children: string }) {
  return (
    <span className="border-2 border-offrip-black bg-offrip-white px-3 py-1.5 font-offrip-display text-[10px] font-bold uppercase tracking-wide text-offrip-black">
      {children}
    </span>
  );
}

function ClickPairRow({ pair }: { pair: ClickPair }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="bg-offrip-black px-3 py-1.5 font-offrip-display text-[10px] font-bold uppercase tracking-wide text-offrip-white">
        {pair.labelA}
      </span>
      <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-offrip-medium-gray" aria-hidden="true" />
      <span className="border-2 border-offrip-black bg-offrip-white px-3 py-1.5 font-offrip-display text-[10px] font-bold uppercase tracking-wide text-offrip-black">
        {pair.labelB}
      </span>
    </div>
  );
}

function OfferList({ items, emptyMessage }: { items: string[]; emptyMessage: string }) {
  if (items.length === 0) {
    return <p className="font-offrip-body text-sm text-offrip-medium-gray">{emptyMessage}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 font-offrip-body text-sm text-offrip-black">
          <span aria-hidden="true">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function FullProfileView({ matchId, currentUserId, onBack, onMakeIntro }: FullProfileViewProps) {
  // undefined = loading, null = not found (or an error -- both render the same honest "couldn't load" state)
  const [detail, setDetail] = useState<MatchDetailResult | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setDetail(undefined);

    fetchMatchDetail(matchId, currentUserId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((error) => {
        console.error("fetchMatchDetail failed:", error);
        if (!cancelled) setDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [matchId, currentUserId]);

  if (detail === undefined) return <LoadingState />;
  if (detail === null) return <MessageState message="We couldn't find this match." onBack={onBack} />;

  const explanation = buildFullProfileExplanation(detail);
  const { otherPerson } = detail;
  const roleCompany = [otherPerson.role_type, otherPerson.company].filter(Boolean).join(" · ");

  return (
    <div className="bg-offrip-white font-offrip-body text-offrip-black">
      <button
        onClick={onBack}
        className="font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-medium-gray hover:text-offrip-black"
      >
        ← Back to Matches
      </button>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
        {/* Left column */}
        <div className="space-y-4">
          <div className={`flex aspect-square w-full items-center justify-center border-2 border-offrip-black ${avatarClasses(otherPerson.id)}`}>
            {otherPerson.avatar_url ? (
              <img src={otherPerson.avatar_url} alt={otherPerson.full_name ?? "Profile photo"} className="h-full w-full object-cover" />
            ) : (
              <span className="font-offrip-display text-6xl font-black text-offrip-black">{initials(otherPerson.full_name)}</span>
            )}
          </div>

          <div>
            <h1 className="font-offrip-display text-2xl font-black uppercase tracking-tight">{otherPerson.full_name ?? "OOO member"}</h1>
            {roleCompany && <p className="mt-1 font-offrip-body text-sm text-offrip-medium-gray">{roleCompany}</p>}
            {otherPerson.location && <p className="font-offrip-body text-sm text-offrip-medium-gray">{otherPerson.location}</p>}
          </div>

          <div className="border-2 border-offrip-black bg-offrip-black p-5 text-center">
            <p className="font-offrip-display text-5xl font-black text-offrip-white">{detail.match.score}%</p>
            <div className="mt-3">
              <OffripChip color="lime">Mutual Value</OffripChip>
            </div>
          </div>

          <OffripButton onClick={onMakeIntro} className="w-full">
            Make the Intro
          </OffripButton>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div>
            <h2 className="font-offrip-display text-3xl font-black uppercase tracking-tight">
              You should know <span>{firstName(otherPerson.full_name)}</span>.
            </h2>
            <blockquote className="mt-3 border-l-4 border-offrip-aqua pl-4 font-offrip-body text-sm italic text-offrip-dark-gray">
              {firstSentence(explanation.whyThisMakesSense)}
            </blockquote>
          </div>

          {otherPerson.areas_of_expertise.length > 0 && (
            <div>
              <p className="font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-medium-gray">Expertise</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {otherPerson.areas_of_expertise.map((area) => (
                  <ExpertisePill key={area}>{area}</ExpertisePill>
                ))}
              </div>
            </div>
          )}

          <OffripCard className="bg-offrip-light-gray p-5">
            <p className="font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-medium-gray">Why This Makes Sense</p>
            <p className="mt-2 font-offrip-body text-sm text-offrip-black">{explanation.whyThisMakesSense}</p>
          </OffripCard>

          <div>
            <p className="font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-medium-gray">Why It Clicks</p>
            {explanation.whyItClicks.length > 0 ? (
              <div className="mt-3 space-y-3">
                {explanation.whyItClicks.map((pair, index) => (
                  <ClickPairRow key={`${pair.labelA}-${pair.labelB}-${index}`} pair={pair} />
                ))}
              </div>
            ) : (
              <p className="mt-2 font-offrip-body text-sm text-offrip-medium-gray">
                No specific alignment pairs found yet -- there may still be common ground worth a conversation.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OffripCard className="p-5">
              <p className="font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-medium-gray">What You Can Offer Them</p>
              <div className="mt-2">
                <OfferList items={explanation.whatYouCanOfferThem} emptyMessage="Nothing specific matched yet." />
              </div>
            </OffripCard>
            <OffripCard className="p-5">
              <p className="font-offrip-display text-xs font-bold uppercase tracking-widest text-offrip-medium-gray">What They Can Offer You</p>
              <div className="mt-2">
                <OfferList items={explanation.whatTheyCanOfferYou} emptyMessage="Nothing specific matched yet." />
              </div>
            </OffripCard>
          </div>
        </div>
      </div>
    </div>
  );
}
