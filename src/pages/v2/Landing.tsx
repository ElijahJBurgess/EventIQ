import { useState } from "react";
import { useNavigate } from "react-router-dom";

const PROFILES = [
  { initials: "JL", name: "Jordan Lee", role: "VP Engineering · TechCo", match: 94, color: "#69C0BE" },
  { initials: "MP", name: "Maya Patel", role: "Investor · Spark Capital", match: 92, color: "#DCE86A" },
  { initials: "TS", name: "Taylor Smith", role: "Founder · Buildr", match: 90, color: "#FF5338" },
  { initials: "AR", name: "Aisha Robinson", role: "Brand Partnerships · Nike", match: 88, color: "#4387F5" },
  { initials: "KW", name: "Kelsey Wong", role: "Product Manager · OpenAI", match: 87, color: "#69C0BE" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const startSignup = () => {
    const query = email.trim() ? `&email=${encodeURIComponent(email.trim())}` : "";
    navigate(`/v2/auth?mode=signup${query}`);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-6 sm:px-8 py-5 flex items-center justify-between border-b border-white/10">
        <div>
          <div className="font-display text-2xl font-black tracking-tight text-white normal-case">OFFRIP</div>
          <div className="text-[10px] text-white/50 tracking-widest font-display mt-0.5">BY OUT OF OFFICE</div>
        </div>
        <button onClick={() => navigate("/v2/auth")} className="text-[11px] tracking-widest border border-white/30 px-4 py-2 hover:border-white text-white/70 hover:text-white transition-colors">
          Sign in
        </button>
      </header>

      <div className="flex-1 grid md:grid-cols-2">
        <div className="flex flex-col justify-center px-8 md:px-16 py-16 md:py-20">
          <div className="text-[11px] tracking-widest font-display text-offrip-aqua mb-6">
            Relationship intelligence for the rooms that matter
          </div>
          <h1 className="font-display font-black text-5xl md:text-7xl leading-[0.92] tracking-tight uppercase text-white mb-6">
            Know<br />who to<br /><span className="text-offrip-orange">know.</span><br />Off rip.
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm mb-6 font-offrip-body">
            Know the room before you work it. Tell us what you're looking for and we'll find the people worth knowing.
          </p>
          <p className="text-white/30 text-sm max-w-sm mb-6 font-offrip-body">Less random networking. Better intros.</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-sm">
            <input
              type="email"
              placeholder="Your work email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && startSignup()}
              className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/30 px-4 py-3 text-sm font-offrip-body outline-none focus:border-offrip-aqua transition-colors"
            />
            <button onClick={startSignup} className="bg-white text-black text-[11px] tracking-widest px-6 py-3 hover:bg-offrip-aqua transition-colors whitespace-nowrap">
              Get in the room
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-10">
            {["AI matching", "Real connections", "Measurable outcomes"].map((feature) => (
              <span key={feature} className="border border-white/20 text-white/50 text-[10px] font-display px-3 py-1.5 uppercase tracking-wider">{feature}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-8 mt-12 border-t border-white/10 pt-8">
            <div className="w-full text-[9px] text-white/25 tracking-widest font-display uppercase">
              Demo metrics · sample data
            </div>
            {[["1,842", "People in the room", "text-white"], ["94%", "Match accuracy", "text-offrip-aqua"], ["412", "Outcomes reported", "text-white"]].map(([value, label, color]) => (
              <div key={label}>
                <div className={`font-display font-black text-2xl ${color}`}>{value}</div>
                <div className="text-[10px] text-white/40 tracking-wider font-display mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative hidden md:flex items-center justify-center overflow-hidden border-l border-white/10">
          <div className="absolute w-80 h-80 rounded-full bg-offrip-aqua/10 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-3 p-8 w-full max-w-sm">
            <div className="text-[10px] tracking-widest font-display text-white/30 mb-2">Don't leave without meeting</div>
            {PROFILES.map((profile) => (
              <div key={profile.initials} className="bg-white/5 border border-white/10 p-4 flex items-center gap-4 hover:bg-white/10 hover:border-white/20 transition-all">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black font-display flex-shrink-0 text-black" style={{ backgroundColor: profile.color }}>{profile.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-display font-black text-white truncate normal-case">{profile.name}</div>
                  <div className="text-[11px] text-white/40 font-offrip-body truncate">{profile.role}</div>
                </div>
                <div className="text-[11px] font-black font-display px-2 py-1 text-black" style={{ backgroundColor: profile.color }}>{profile.match}% match</div>
              </div>
            ))}
            <div className="mt-2 bg-offrip-aqua p-4">
              <div className="text-[10px] tracking-widest font-display text-black mb-1">OFFRIP concierge</div>
              <div className="text-sm font-offrip-body text-black/70">“Who should I meet if I'm looking for a technical cofounder?”</div>
              <div className="mt-2 text-[10px] font-display text-black">→ 3 strong matches found</div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 px-6 sm:px-8 py-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="text-[10px] text-white/20 font-display tracking-widest">© 2026 Out Of Office. All rights reserved.</div>
        <button onClick={() => navigate("/v2/admin")} className="text-[10px] text-white/30 font-display tracking-widest hover:text-white/60">Enterprise →</button>
      </footer>
    </div>
  );
}
