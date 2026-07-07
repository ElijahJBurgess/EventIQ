import { type ReactNode, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Database,
  Download,
  Handshake,
  LineChart,
  Link as LinkIcon,
  LockKeyhole,
  Network,
  QrCode,
  Search,
  Sparkles,
  Target,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Screen =
  | "landing"
  | "welcome"
  | "join"
  | "profile"
  | "goals"
  | "event"
  | "matches"
  | "matchDetail"
  | "concierge"
  | "saved"
  | "admin"
  | "sponsor"
  | "organizer"
  | "integrations"
  | "dataModel";

type RoleType =
  | "Professional"
  | "Recruiter"
  | "Hiring Manager"
  | "Founder"
  | "Investor"
  | "Brand Partner"
  | "Creator"
  | "Student"
  | "Other";

type Match = {
  name: string;
  title: string;
  company: string;
  role: RoleType;
  score: number;
  why: string;
  goals: string[];
};

type RegistrationDraft = {
  eventCode: string;
  selectedEvent: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  jobTitle: string;
  company: string;
  city: string;
  linkedinUrl: string;
  profilePhotoUrl: string;
  careerStage: string;
  lookingFor: string;
  offering: string;
  raisingNow: string;
  companyStage: string;
  revenueBand: string;
  checkSize: string;
  focusSectors: string;
  hiringNow: string;
  openRoles: string;
  skillsNeeded: string;
  brandLookingFor: string;
};

type ConnectionAction =
  | "view_profile"
  | "save_contact"
  | "request_intro"
  | "mark_met"
  | "linkedin_click"
  | "draft_followup";

const navItems: { label: string; screen: Screen }[] = [
  { label: "Home", screen: "landing" },
  { label: "Join Event", screen: "join" },
  { label: "Profile", screen: "profile" },
  { label: "Matches", screen: "matches" },
  { label: "Concierge", screen: "concierge" },
  { label: "Saved Connections", screen: "saved" },
  { label: "Admin Dashboard", screen: "admin" },
  { label: "Sponsor Dashboard", screen: "sponsor" },
  { label: "Organizer Dashboard", screen: "organizer" },
];

const matches: Match[] = [
  {
    name: "Maya Johnson",
    title: "Senior Product Manager",
    company: "Google",
    role: "Professional",
    score: 92,
    why: "Both interested in AI talent, product leadership, and future of work.",
    goals: ["AI talent", "Product", "Hiring"],
  },
  {
    name: "Andre Williams",
    title: "Founder",
    company: "CultureHouse Labs",
    role: "Founder",
    score: 88,
    why: "Founder looking for brand partnerships and investor connections.",
    goals: ["Partnerships", "Investors", "Culture"],
  },
  {
    name: "Priya Shah",
    title: "Investor",
    company: "Northstar Ventures",
    role: "Investor",
    score: 85,
    why: "Invests in early-stage companies across culture, commerce, and SaaS.",
    goals: ["SaaS", "Commerce", "Seed"],
  },
  {
    name: "Jordan Ellis",
    title: "Head of Talent",
    company: "Stripe",
    role: "Recruiter",
    score: 84,
    why: "Hiring product and GTM leaders with strong marketplace experience.",
    goals: ["Hiring", "GTM", "Product"],
  },
  {
    name: "Nia Brooks",
    title: "Brand Partnerships",
    company: "Nike",
    role: "Brand Partner",
    score: 83,
    why: "Exploring creator-led activations and culture-forward partnerships.",
    goals: ["Creators", "Brand", "Activation"],
  },
  {
    name: "Leo Kim",
    title: "Engineering Manager",
    company: "Linear",
    role: "Hiring Manager",
    score: 81,
    why: "Needs senior frontend talent and shares interest in high-velocity SaaS teams.",
    goals: ["Talent", "SaaS", "Engineering"],
  },
  {
    name: "Sofia Martinez",
    title: "Creator Strategist",
    company: "Studio Mesa",
    role: "Creator",
    score: 79,
    why: "Builds campaigns for B2B brands reaching technical audiences.",
    goals: ["Content", "Sponsors", "Community"],
  },
  {
    name: "Ethan Cole",
    title: "Founder",
    company: "SignalForge",
    role: "Founder",
    score: 77,
    why: "B2B founder looking for buyers, advisors, and seed investors.",
    goals: ["Buyers", "Seed", "Advisors"],
  },
  {
    name: "Ava Chen",
    title: "VP Sales",
    company: "Notion",
    role: "Professional",
    score: 75,
    why: "Can advise on enterprise buying motions and partner ecosystems.",
    goals: ["Enterprise", "Partners", "Sales"],
  },
  {
    name: "Malik Reed",
    title: "MBA Candidate",
    company: "Wharton",
    role: "Student",
    score: 71,
    why: "Career switcher seeking product roles and founder mentorship.",
    goals: ["Jobs", "Mentorship", "Product"],
  },
];

const demoEvent = {
  name: "OOO Connect Summit",
  location: "New York City",
  date: "April 29, 2026",
  attendees: "750+",
  sponsors: ["Google", "LinkedIn", "Spotify", "Uber", "Levi’s", "NYC Tourism"],
};

const emptyRegistration: RegistrationDraft = {
  eventCode: "OOO-2026",
  selectedEvent: demoEvent.name,
  fullName: "",
  email: "",
  phoneNumber: "",
  jobTitle: "",
  company: "",
  city: "",
  linkedinUrl: "",
  profilePhotoUrl: "",
  careerStage: "Senior",
  lookingFor: "",
  offering: "",
  raisingNow: "Yes",
  companyStage: "",
  revenueBand: "",
  checkSize: "",
  focusSectors: "",
  hiringNow: "Yes",
  openRoles: "",
  skillsNeeded: "",
  brandLookingFor: "Creators",
};

const dashboardMetrics = [
  ["Registered attendees", "752", Users],
  ["Checked in", "618", QrCode],
  ["Completed profiles", "483", Check],
  ["Match views", "2,940", BarChart3],
  ["Saved matches", "816", Network],
  ["Requested intros", "274", Handshake],
  ["Marked met", "139", Check],
  ["Concierge prompts used", "412", Bot],
] as const;

const sponsorGoals = [
  "Meet product managers",
  "Meet AI talent",
  "Meet senior operators",
  "Drive employer brand engagement",
];

const sponsorLeads = [
  {
    name: "Maya Johnson",
    title: "Senior Product Manager",
    company: "Google",
    why: "Senior product leader with AI hiring context and enterprise collaboration experience.",
    status: "High-intent",
  },
  {
    name: "Daniel Park",
    title: "AI Program Manager",
    company: "Microsoft",
    why: "Owns cross-functional AI initiatives and is actively exploring future-of-work communities.",
    status: "New",
  },
  {
    name: "Andre Williams",
    title: "Founder",
    company: "FutureWork Studio",
    why: "Founder building a future of work startup with strong talent marketplace overlap.",
    status: "Saved",
  },
  {
    name: "Sofia Martinez",
    title: "Creator",
    company: "Enterprise Operator",
    why: "Creator with an enterprise audience across AI productivity and operator workflows.",
    status: "Follow-up",
  },
  {
    name: "Leo Kim",
    title: "Engineering Manager",
    company: "Linear",
    why: "Engineering manager exploring senior roles and high-trust employer communities.",
    status: "Met",
  },
];

const analyticsEvents = [
  "Registration complete",
  "Profile complete",
  "Joined event",
  "Checked in",
  "Viewed matches",
  "Saved match",
  "Requested intro",
  "Marked met",
  "Used concierge",
  "Sponsor profile opened",
];
const goals = [
  "Find job opportunities",
  "Hire talent",
  "Meet investors",
  "Meet founders",
  "Find clients",
  "Partnerships",
  "Creator deals",
  "Build network",
  "Learn from others",
];
const integrations = [
  "Eventbrite",
  "Luma",
  "Eventnoire",
  "Partiful",
  "Posh",
  "Salesforce",
  "HubSpot",
  "Greenhouse",
  "Lever",
  "Zapier",
  "Slack",
];
const dataTables = [
  "users",
  "profiles",
  "events",
  "registrations",
  "checkins",
  "matches",
  "saves",
  "intros",
  "concierge_logs",
  "sponsors",
  "sponsor_leads",
  "analytics_events",
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("");

const Index = () => {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [selectedMatch, setSelectedMatch] = useState(matches[0]);
  const [role, setRole] = useState<RoleType>("Founder");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    "Meet investors",
    "Partnerships",
    "Build network",
  ]);
  const [conciergePrompt, setConciergePrompt] = useState(
    "Who should I meet first?",
  );
  const [saved, setSaved] = useState<string[]>(["Maya Johnson", "Priya Shah"]);
  const [met, setMet] = useState<string[]>(["Maya Johnson"]);
  const [registration, setRegistration] =
    useState<RegistrationDraft>(emptyRegistration);

  const activeTitle = useMemo(
    () =>
      navItems.find((item) => item.screen === screen)?.label ??
      "OOO Intelligence",
    [screen],
  );

  const trackEvent = async (eventName: string, label?: string, metadata = {}) => {
    await supabase.from("event_analytics").insert({
      event_name: eventName,
      screen,
      label,
      metadata,
    });
  };

  const go = (target: Screen) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    void trackEvent("screen_navigation", target);
    setScreen(target);
  };

  const recordConnectionAction = async (
    match: Match,
    actionType: ConnectionAction,
    context = {},
  ) => {
    await supabase.from("connection_actions").insert({
      match_name: match.name,
      match_company: match.company,
      action_type: actionType,
      context,
    });
  };

  const saveMatch = (match: Match) => {
    setSaved((current) =>
      current.includes(match.name) ? current : [...current, match.name],
    );
    void recordConnectionAction(match, "save_contact");
    toast({ title: "Saved", description: `${match.name} was added to your connections.` });
  };

  const requestIntro = (match: Match) => {
    void recordConnectionAction(match, "request_intro");
    toast({ title: "Intro requested", description: `A request was logged for ${match.name}.` });
  };

  const markMet = (match: Match) => {
    setMet((current) =>
      current.includes(match.name) ? current : [...current, match.name],
    );
    void recordConnectionAction(match, "mark_met");
    toast({ title: "Meeting recorded", description: `${match.name} is marked as met.` });
  };

  const recordAdminAction = async (actionType: string, label: string, context = {}) => {
    await supabase.from("admin_actions").insert({ action_type: actionType, label, context });
    toast({ title: "Action recorded", description: `${label} was logged.` });
  };

  const submitRegistration = async (sourceScreen: "join" | "profile" | "goals") => {
    const { error } = await supabase.from("event_registrations").insert({
      event_code: registration.eventCode,
      selected_event: registration.selectedEvent,
      full_name: registration.fullName,
      email: registration.email,
      phone_number: registration.phoneNumber,
      job_title: registration.jobTitle,
      company: registration.company,
      city: registration.city,
      linkedin_url: registration.linkedinUrl,
      profile_photo_url: registration.profilePhotoUrl,
      role_type: role,
      career_stage: registration.careerStage,
      goals: selectedGoals,
      looking_for: registration.lookingFor,
      offering: registration.offering,
      source_screen: sourceScreen,
      role_details: {
        raisingNow: registration.raisingNow,
        companyStage: registration.companyStage,
        revenueBand: registration.revenueBand,
        checkSize: registration.checkSize,
        focusSectors: registration.focusSectors,
        hiringNow: registration.hiringNow,
        openRoles: registration.openRoles,
        skillsNeeded: registration.skillsNeeded,
        brandLookingFor: registration.brandLookingFor,
      },
    });

    if (error) {
      toast({ title: "Could not save", description: "Check the form and try again." });
      return false;
    }

    toast({ title: "Saved", description: "Your event data was collected securely." });
    return true;
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-aqua text-foreground selection:bg-citron selection:text-citron-foreground">
      <div className="fixed inset-x-0 top-0 z-50 border-b-2 border-primary bg-card/95 shadow-hairline backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            onClick={() => go("landing")}
            className="flex items-center gap-3 text-left"
            aria-label="OOO Intelligence home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-normal">
                OOO
              </span>
              <span className="block text-xs text-charcoal">Intelligence</span>
            </span>
          </button>
          <nav className="hidden max-w-3xl items-center gap-1 overflow-x-auto lg:flex">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => go(item.screen)}
                className={`rounded-full border-2 border-primary px-3 py-2 text-xs font-semibold transition ${screen === item.screen ? "bg-aqua text-aqua-foreground shadow-card" : "bg-card text-charcoal hover:bg-warm hover:text-foreground"}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <Button variant="hero" size="sm" onClick={() => go("welcome")}>
            Launch demo <ArrowRight />
          </Button>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => go(item.screen)}
              className={`shrink-0 rounded-full border-2 border-primary px-3 py-2 text-xs font-semibold ${screen === item.screen ? "bg-aqua text-aqua-foreground shadow-card" : "bg-card text-charcoal"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-7xl overflow-x-hidden px-4 pb-20 pt-36 sm:px-6 lg:pt-32">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="w-fit rounded-full border-2 border-primary bg-card px-4 py-2 text-xs font-bold uppercase text-vermillion shadow-card">
            {activeTitle}
          </p>
          <p className="w-fit max-w-full truncate rounded-full border-2 border-primary bg-card px-4 py-2 text-xs font-bold text-charcoal shadow-card">
            Beta · {demoEvent.name} · {demoEvent.location}
          </p>
          <button
            onClick={() => go("integrations")}
            className="hidden items-center gap-2 rounded-full border-2 border-primary bg-card px-4 py-2 text-sm font-semibold shadow-card transition hover:-translate-y-0.5 md:flex"
          >
            Integrations <Zap className="h-4 w-4" />
          </button>
        </div>
        {screen === "landing" && <Landing go={go} />}
        {screen === "welcome" && <Welcome go={go} />}
        {screen === "join" && (
          <JoinEvent
            go={go}
            registration={registration}
            setRegistration={setRegistration}
            submitRegistration={submitRegistration}
          />
        )}
        {screen === "profile" && (
          <ProfileSetup
            go={go}
            role={role}
            setRole={setRole}
            registration={registration}
            setRegistration={setRegistration}
            submitRegistration={submitRegistration}
          />
        )}
        {screen === "goals" && (
          <GoalsSetup
            go={go}
            role={role}
            selectedGoals={selectedGoals}
            setSelectedGoals={setSelectedGoals}
            registration={registration}
            setRegistration={setRegistration}
            submitRegistration={submitRegistration}
          />
        )}
        {screen === "event" && <EventHome go={go} />}
        {screen === "matches" && (
          <MatchesFeed
            go={go}
            saved={saved}
            saveMatch={saveMatch}
            requestIntro={requestIntro}
            setSelectedMatch={setSelectedMatch}
            recordConnectionAction={recordConnectionAction}
          />
        )}
        {screen === "matchDetail" && (
          <MatchDetail
            match={selectedMatch}
            go={go}
            saveMatch={saveMatch}
            requestIntro={requestIntro}
            markMet={markMet}
            recordConnectionAction={recordConnectionAction}
          />
        )}
        {screen === "concierge" && (
          <Concierge prompt={conciergePrompt} setPrompt={setConciergePrompt} />
        )}
        {screen === "saved" && (
          <SavedConnections
            saved={saved}
            met={met}
            go={go}
            recordConnectionAction={recordConnectionAction}
          />
        )}
        {screen === "admin" && <AdminDashboard go={go} recordAdminAction={recordAdminAction} />}
        {screen === "sponsor" && <SponsorDashboard recordAdminAction={recordAdminAction} />}
        {screen === "organizer" && <OrganizerDashboard recordAdminAction={recordAdminAction} />}
        {screen === "integrations" && <Integrations />}
        {screen === "dataModel" && <DataModel />}
      </section>
    </main>
  );
};

const Panel = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={`animate-fade-in rounded-[0.875rem] border-2 border-primary bg-card p-6 shadow-hairline sm:p-8 ${className}`}
  >
    {children}
  </div>
);
const Stat = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) => (
  <Panel className="group p-5 hover-lift sm:p-6">
    <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary bg-citron text-citron-foreground transition group-hover:scale-105">
      <Icon className="h-5 w-5" />
    </div>
    <p className="text-3xl font-black leading-none sm:text-4xl">{value}</p>
    <p className="mt-2 text-sm font-semibold text-charcoal">{label}</p>
  </Panel>
);
const Field = ({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
}) => (
  <label className="grid gap-2 text-sm font-bold">
    <span>{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder ?? label}
      className="min-h-12 rounded-xl border-2 border-primary bg-card/80 px-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
    />
  </label>
);

const PhoneShell = ({ children }: { children: ReactNode }) => (
    <div className="mx-auto w-full max-w-[430px] rounded-[2.375rem] border-2 border-primary bg-card p-3 shadow-soft">
    <div className="min-h-[620px] overflow-hidden rounded-[0.875rem] border-2 border-primary bg-aqua p-5 sm:p-6">
      {children}
    </div>
  </div>
);
const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  options: string[];
}) => (
  <label className="grid gap-2 text-sm font-bold">
    <span>{label}</span>
    <select
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className="min-h-12 rounded-xl border-2 border-primary bg-card/80 px-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  </label>
);

function Landing({ go }: { go: (screen: Screen) => void }) {
  const features = [
    [
      Target,
      "Smart Matching",
      "Connect attendees, sponsors, talent, founders, investors, and buyers with the right people in the room.",
    ],
    [
      Bot,
      "OOO Concierge",
      "AI-powered recommendations that help attendees know who to meet, what to say, and how to follow up.",
    ],
    [
      CircleDollarSign,
      "Sponsor Dashboards",
      "Give sponsors visibility into qualified leads, meetings, engagement, and ROI.",
    ],
    [
      LineChart,
      "Event Intelligence",
      "Track attendee behavior, sentiment, check-ins, match engagement, and business outcomes.",
    ],
    [
      LockKeyhole,
      "Enterprise Ready",
      "Start with CSV imports and exports, then expand into CRM, ATS, and event platform integrations.",
    ],
  ] as const;
  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="animate-fade-up py-8 lg:py-16">
        <p className="mb-5 inline-flex rounded-full border-2 border-primary bg-aqua px-4 py-2 text-xs font-bold uppercase text-aqua-foreground shadow-card">
          AI event intelligence platform
        </p>
        <h1 className="max-w-4xl text-balance text-5xl font-black leading-[0.95] sm:text-7xl lg:text-8xl">
          Turn every event into measurable ROI.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-charcoal">
          OOO Intelligence helps companies, sponsors, and event organizers
          identify the right people, spark meaningful connections, and measure
          hiring, pipeline, partnership, and networking outcomes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="hero" size="lg" onClick={() => go("welcome")}>
            Request Demo <ArrowRight />
          </Button>
          <Button variant="quiet" size="lg" onClick={() => go("join")}>
            Join Event
          </Button>
        </div>
      </div>
      <Panel className="relative overflow-hidden bg-aqua p-4 lg:p-6">
        <div className="absolute right-8 top-8 h-28 w-28 rounded-full bg-citron/70 blur-3xl" />
        <div className="grid gap-4">
          {features.map(([Icon, title, copy], index) => (
            <div
              key={title}
              className="group rounded-[0.875rem] border-2 border-primary bg-card p-5 transition hover:-translate-y-1 hover:shadow-card"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="mb-1 font-black">
                    {index + 1}. {title}
                  </p>
                  <p className="text-sm leading-6 text-charcoal">{copy}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Welcome({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_430px]">
      <PhoneShell>
        <div className="flex min-h-[570px] flex-col justify-between">
          <div>
            <p className="mb-5 inline-flex rounded-full border-2 border-primary bg-citron px-4 py-2 text-xs font-bold uppercase text-citron-foreground shadow-card">
              Enterprise demo · {demoEvent.attendees} attendees
            </p>
            <h1 className="text-balance text-5xl font-black leading-[0.9] sm:text-6xl">
              Meet the room before you work the room.
            </h1>
            <p className="mt-6 text-lg font-medium leading-7 text-charcoal">
              OOO helps you find the right people, conversations, and
              opportunities at every event.
            </p>
          </div>
          <div className="mt-10 grid gap-3">
            <Button variant="hero" size="lg" onClick={() => go("join")}>
              Join Event
            </Button>
            <Button variant="ink" size="lg" onClick={() => go("profile")}>
              Create Profile
            </Button>
            <Button variant="quiet" size="lg" onClick={() => go("event")}>
              Log In
            </Button>
          </div>
        </div>
      </PhoneShell>
      <Panel className="bg-card text-foreground">
        <p className="mb-2 text-sm opacity-70">Live event signal</p>
        <h2 className="mb-8 text-3xl font-black">{demoEvent.name}</h2>
        <div className="mb-8 flex flex-wrap gap-2">
          {demoEvent.sponsors.map((sponsor) => (
            <span
              key={sponsor}
              className="rounded-full border-2 border-primary bg-aqua px-3 py-1 text-xs font-bold text-aqua-foreground"
            >
              {sponsor}
            </span>
          ))}
        </div>
        <div className="space-y-4">
          {[
            "Pipeline fit",
            "Talent density",
            "Partnership intent",
            "Investor relevance",
          ].map((item, index) => (
            <div key={item} className="rounded-[0.875rem] border-2 border-primary bg-warm p-4">
              <div className="flex justify-between text-sm">
                <span>{item}</span>
                <span>{94 - index * 7}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-card">
                <div
                  className="h-2 rounded-full bg-aqua"
                  style={{ width: `${94 - index * 7}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function JoinEvent({
  go,
  registration,
  setRegistration,
  submitRegistration,
}: {
  go: (screen: Screen) => void;
  registration: RegistrationDraft;
  setRegistration: (registration: RegistrationDraft) => void;
  submitRegistration: (sourceScreen: "join" | "profile" | "goals") => Promise<boolean>;
}) {
  return (
    <Panel className="mx-auto max-w-3xl">
      <h1 className="text-4xl font-black">Join Event</h1>
      <p className="mt-2 text-charcoal">
        Enter a code, scan a QR, or choose an active event.
      </p>
      <div className="mt-8 grid gap-5">
        <Field
          label="Event code"
          placeholder="OOO-2026"
          value={registration.eventCode}
          onChange={(value) => setRegistration({ ...registration, eventCode: value })}
        />
        <Button variant="quiet" className="h-20 justify-start rounded-3xl" onClick={() => {
          void supabase.from("event_analytics").insert({ event_name: "qr_scan_clicked", screen: "join", label: "QR placeholder button" });
          toast({ title: "QR scan ready", description: "QR check-in action was recorded." });
        }}>
          <QrCode /> QR placeholder button
        </Button>
        <SelectField
          label="Select event"
          value={registration.selectedEvent}
          onChange={(value) => setRegistration({ ...registration, selectedEvent: value })}
          options={[
            demoEvent.name,
            "AI Hiring Leaders Forum",
            "Founder Operator Mixer",
          ]}
        />
        <Button variant="hero" size="lg" onClick={async () => (await submitRegistration("join")) && go("profile")}>
          Join Event <ChevronRight />
        </Button>
      </div>
    </Panel>
  );
}

function ProfileSetup({
  go,
  role,
  setRole,
  registration,
  setRegistration,
  submitRegistration,
}: {
  go: (screen: Screen) => void;
  role: RoleType;
  setRole: (role: RoleType) => void;
  registration: RegistrationDraft;
  setRegistration: (registration: RegistrationDraft) => void;
  submitRegistration: (sourceScreen: "join" | "profile" | "goals") => Promise<boolean>;
}) {
  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image", description: "Upload a JPG, PNG, or WEBP file." });
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (error) {
      toast({ title: "Upload failed", description: "Please try another image." });
      return;
    }

    const { data } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
    setRegistration({ ...registration, profilePhotoUrl: data.publicUrl });
    void supabase.from("event_analytics").insert({ event_name: "photo_uploaded", screen: "profile", label: file.name });
    toast({ title: "Photo uploaded", description: "Your profile picture is attached." });
  };

  return (
    <Panel>
      <h1 className="text-4xl font-black">Profile Setup</h1>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Field label="Full Name" value={registration.fullName} onChange={(value) => setRegistration({ ...registration, fullName: value })} />
        <Field label="Email" type="email" value={registration.email} onChange={(value) => setRegistration({ ...registration, email: value })} />
        <Field label="Phone Number" value={registration.phoneNumber} onChange={(value) => setRegistration({ ...registration, phoneNumber: value })} />
        <label className="flex min-h-12 cursor-pointer items-center justify-start gap-2 rounded-xl border-2 border-primary bg-card px-4 text-sm font-medium shadow-card transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-citron">
          <Upload className="h-4 w-4" />
          {registration.profilePhotoUrl ? "Photo uploaded" : "Upload profile photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadPhoto(file);
            }}
          />
        </label>
        <Field label="Job Title" value={registration.jobTitle} onChange={(value) => setRegistration({ ...registration, jobTitle: value })} />
        <Field label="Company / Organization" value={registration.company} onChange={(value) => setRegistration({ ...registration, company: value })} />
        <Field label="City" value={registration.city} onChange={(value) => setRegistration({ ...registration, city: value })} />
        <Field label="LinkedIn URL" value={registration.linkedinUrl} onChange={(value) => setRegistration({ ...registration, linkedinUrl: value })} />
        <SelectField
          label="Role Type"
          value={role}
          onChange={(value) => setRole(value as RoleType)}
          options={[
            "Professional",
            "Recruiter",
            "Hiring Manager",
            "Founder",
            "Investor",
            "Brand Partner",
            "Creator",
            "Student",
            "Other",
          ]}
        />
        <SelectField
          label="Career Stage"
          value={registration.careerStage}
          onChange={(value) => setRegistration({ ...registration, careerStage: value })}
          options={["Entry", "Mid", "Senior", "Executive", "Founder"]}
        />
      </div>
      <div className="mt-8 flex justify-end">
        <Button variant="hero" size="lg" onClick={async () => (await submitRegistration("profile")) && go("goals")}>
          Continue to goals
        </Button>
      </div>
    </Panel>
  );
}

function GoalsSetup({
  go,
  role,
  selectedGoals,
  setSelectedGoals,
  registration,
  setRegistration,
  submitRegistration,
}: {
  go: (screen: Screen) => void;
  role: RoleType;
  selectedGoals: string[];
  setSelectedGoals: (goals: string[]) => void;
  registration: RegistrationDraft;
  setRegistration: (registration: RegistrationDraft) => void;
  submitRegistration: (sourceScreen: "join" | "profile" | "goals") => Promise<boolean>;
}) {
  const toggle = (goal: string) =>
    setSelectedGoals(
      selectedGoals.includes(goal)
        ? selectedGoals.filter((item) => item !== goal)
        : [...selectedGoals, goal],
    );
  return (
    <Panel>
      <h1 className="text-4xl font-black">Goals Setup</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => (
          <button
            key={goal}
            onClick={() => toggle(goal)}
            className={`rounded-[0.875rem] border-2 p-4 text-left font-bold transition hover:-translate-y-0.5 ${selectedGoals.includes(goal) ? "border-primary bg-aqua text-aqua-foreground shadow-card" : "border-primary bg-card"}`}
          >
            <Check className="mb-4 h-5 w-5" />
            {goal}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Field label="What are you looking for?" value={registration.lookingFor} onChange={(value) => setRegistration({ ...registration, lookingFor: value })} />
        <Field label="What can you offer others?" value={registration.offering} onChange={(value) => setRegistration({ ...registration, offering: value })} />
        {role === "Founder" && (
          <>
            <SelectField label="Raising now?" value={registration.raisingNow} onChange={(value) => setRegistration({ ...registration, raisingNow: value })} options={["Yes", "No"]} />
            <Field label="Company stage" value={registration.companyStage} onChange={(value) => setRegistration({ ...registration, companyStage: value })} />
            <Field label="Revenue band" value={registration.revenueBand} onChange={(value) => setRegistration({ ...registration, revenueBand: value })} />
          </>
        )}
        {role === "Investor" && (
          <>
            <Field label="Check size" value={registration.checkSize} onChange={(value) => setRegistration({ ...registration, checkSize: value })} />
            <Field label="Focus sectors" value={registration.focusSectors} onChange={(value) => setRegistration({ ...registration, focusSectors: value })} />
          </>
        )}
        {(role === "Recruiter" || role === "Hiring Manager") && (
          <>
            <SelectField label="Hiring now?" value={registration.hiringNow} onChange={(value) => setRegistration({ ...registration, hiringNow: value })} options={["Yes", "No"]} />
            <Field label="Open roles" value={registration.openRoles} onChange={(value) => setRegistration({ ...registration, openRoles: value })} />
            <Field label="Skills needed" value={registration.skillsNeeded} onChange={(value) => setRegistration({ ...registration, skillsNeeded: value })} />
          </>
        )}
        {role === "Brand Partner" && (
          <SelectField
            label="Looking for"
              value={registration.brandLookingFor}
              onChange={(value) => setRegistration({ ...registration, brandLookingFor: value })}
            options={["Creators", "Talent", "Partners", "Buyers"]}
          />
        )}
      </div>
      <div className="mt-8 flex justify-end">
        <Button variant="hero" size="lg" onClick={async () => (await submitRegistration("goals")) && go("event")}>
          Complete profile
        </Button>
      </div>
    </Panel>
  );
}

function EventHome({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Panel>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="mb-3 text-sm font-bold uppercase text-charcoal">
              Sample event
            </p>
            <h1 className="text-4xl font-black sm:text-6xl">
              {demoEvent.name}
            </h1>
            <p className="mt-3 text-lg text-charcoal">
              {demoEvent.date} · {demoEvent.location}
            </p>
          </div>
          <div className="rounded-[0.875rem] border-2 border-primary bg-card p-4">
            <p className="text-xs font-bold uppercase text-charcoal">
              Sponsors
            </p>
            <p className="mt-2 max-w-md text-sm font-bold leading-6">
              {demoEvent.sponsors.join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Check-in status" value="Live" icon={Check} />
          <Stat label="Total attendees" value="750+" icon={Users} />
          <Stat label="Matches" value="37" icon={Network} />
          <Stat label="Venue" value="NYC" icon={CalendarDays} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="hero" onClick={() => go("matches")}>
            View Matches
          </Button>
          <Button variant="ink" onClick={() => go("concierge")}>
            Ask Concierge
          </Button>
          <Button variant="quiet" onClick={() => go("saved")}>
            Saved Connections
          </Button>
        </div>
      </Panel>
      <AnalyticsLog />
    </div>
  );
}

function MatchesFeed({
  go,
  saved,
  saveMatch,
  requestIntro,
  setSelectedMatch,
  recordConnectionAction,
}: {
  go: (screen: Screen) => void;
  saved: string[];
  saveMatch: (match: Match) => void;
  requestIntro: (match: Match) => void;
  setSelectedMatch: (match: Match) => void;
  recordConnectionAction: (match: Match, actionType: ConnectionAction, context?: object) => Promise<void>;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
      <div>
        <PhoneShell>
          <div className="flex h-full flex-col gap-5">
            <div className="flex items-center justify-between">
              <p className="font-label text-xl tracking-[0.12em]">Top match</p>
              <span className="rounded-full border-2 border-primary bg-aqua px-3 py-1 text-xs font-black">
                92%
              </span>
            </div>
            <Avatar name={matches[0].name} large />
            <h1 className="text-4xl font-black">{matches[0].name}</h1>
            <p className="text-lg font-bold text-charcoal">
              {matches[0].title} · {matches[0].company}
            </p>
            <p className="rounded-[0.875rem] border-2 border-primary bg-card p-4 text-sm leading-6 text-charcoal shadow-card">
              {matches[0].why}
            </p>
            <Button
              variant="hero"
              onClick={() => {
                setSelectedMatch(matches[0]);
                void recordConnectionAction(matches[0], "view_profile", { source: "top_match" });
                go("matchDetail");
              }}
            >
              Open connection card
            </Button>
          </div>
        </PhoneShell>
      </div>
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl font-black">Matches Feed</h1>
          <Button variant="quiet" onClick={() => go("concierge")}>
            Ask for ranking
          </Button>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {matches.map((match) => (
            <Panel key={match.name} className="hover-lift">
              <div className="flex flex-col gap-5 sm:flex-row">
                <Avatar name={match.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black leading-tight">
                        {match.name}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-charcoal">
                        {match.title}, {match.company}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-aqua px-3 py-1 text-sm font-black text-aqua-foreground">
                      {match.score}% Match
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-black uppercase text-foreground">
                    {match.role}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-charcoal">
                    {match.why}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {match.goals.map((goal) => (
                      <span
                        key={goal}
                        className="rounded-full border-2 border-primary bg-warm px-3 py-1 text-xs font-bold text-charcoal"
                      >
                        {goal}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      variant="ink"
                      size="sm"
                      onClick={() => {
                        setSelectedMatch(match);
                        void recordConnectionAction(match, "view_profile", { source: "matches_feed" });
                        go("matchDetail");
                      }}
                    >
                      View Profile
                    </Button>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => saveMatch(match)}
                    >
                      {saved.includes(match.name) ? "Saved" : "Save"}
                    </Button>
                    <Button variant="hero" size="sm" onClick={() => requestIntro(match)}>
                      Request Intro
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchDetail({
  match,
  go,
  saveMatch,
  requestIntro,
  markMet,
  recordConnectionAction,
}: {
  match: Match;
  go: (screen: Screen) => void;
  saveMatch: (match: Match) => void;
  requestIntro: (match: Match) => void;
  markMet: (match: Match) => void;
  recordConnectionAction: (match: Match, actionType: ConnectionAction, context?: object) => Promise<void>;
}) {
  return (
    <Panel className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-6 sm:flex-row">
        <Avatar name={match.name} large />
        <div>
          <h1 className="text-5xl font-black">{match.name}</h1>
          <p className="mt-2 text-lg text-charcoal">
            {match.title} · {match.company}
          </p>
          <p className="mt-4 inline-flex rounded-full bg-aqua px-4 py-2 font-black text-aqua-foreground">
            {match.score}% Match
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Info
          title="Why this person is relevant"
          copy={`${match.why} Weighted matching shows strong role compatibility, goals overlap, keyword relevance, and seniority alignment.`}
        />
        <Info
          title="Suggested opener"
          copy={`“Hi ${match.name.split(" ")[0]}, OOO flagged your work at ${match.company}. I’m exploring ${match.goals[0].toLowerCase()} and would love to compare notes for five minutes.”`}
        />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="quiet" onClick={() => recordConnectionAction(match, "linkedin_click")}>
          <LinkIcon /> LinkedIn
        </Button>
        <Button variant="ink" onClick={() => saveMatch(match)}>
          Save contact
        </Button>
        <Button variant="quiet" onClick={() => markMet(match)}>Mark Met</Button>
        <Button variant="hero" onClick={() => requestIntro(match)}>Request Intro</Button>
        <Button variant="quiet" onClick={() => go("matches")}>
          Back to Matches
        </Button>
      </div>
    </Panel>
  );
}

function Concierge({
  prompt,
  setPrompt,
}: {
  prompt: string;
  setPrompt: (prompt: string) => void;
}) {
  const prompts = [
    "Who should I meet first?",
    "Which investors should I prioritize?",
    "Show recruiters hiring product managers",
    "Best people for partnerships",
    "Draft follow-up for Maya",
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Panel className="bg-aqua text-aqua-foreground">
        <h1 className="text-3xl font-black">OOO Concierge</h1>
        <div className="mt-6 grid gap-3">
          {prompts.map((item) => (
            <button
              key={item}
              onClick={() => {
                setPrompt(item);
                void supabase.from("concierge_logs").insert({
                  prompt: item,
                  recommended_matches: matches.slice(0, 3).map((match) => match.name),
                  context: { source: "concierge_prompt_button" },
                });
              }}
              className={`rounded-xl border-2 border-primary p-4 text-left text-sm font-bold transition hover:-translate-y-0.5 ${prompt === item ? "bg-citron text-citron-foreground shadow-card" : "bg-card text-foreground hover:bg-warm"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </Panel>
      <Panel className="bg-aqua text-aqua-foreground">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-primary bg-aqua text-aqua-foreground shadow-card">
            <Bot />
          </span>
          <div>
            <p className="font-black">AI response</p>
            <p className="text-sm text-charcoal">
              Prompt: {prompt}
            </p>
          </div>
        </div>
        <div className="rounded-[0.875rem] border-2 border-primary bg-warm p-5">
          <p className="text-lg font-black">Ranked recommendations</p>
          <ol className="mt-4 space-y-4">
            {matches.slice(0, 3).map((match, index) => (
              <li
                key={match.name}
                className="rounded-xl border-2 border-primary bg-card p-4 shadow-card"
              >
                <p className="font-black">
                  {index + 1}. {match.name} · {match.score}%
                </p>
                <p className="mt-1 text-sm leading-6 text-charcoal">
                  Reasoning: {match.why}
                </p>
                <p className="mt-3 text-sm font-bold">
                  Intro copy: “Your work on {match.goals[0].toLowerCase()} stood
                  out. OOO suggested we connect while we’re both here.”
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Panel>
    </div>
  );
}

function SavedConnections({
  saved,
  met,
  go,
  recordConnectionAction,
}: {
  saved: string[];
  met: string[];
  go: (screen: Screen) => void;
  recordConnectionAction: (match: Match, actionType: ConnectionAction, context?: object) => Promise<void>;
}) {
  const savedMatches = matches.filter((match) => saved.includes(match.name));
  return (
    <Panel>
      <h1 className="text-4xl font-black">Saved Connections</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {savedMatches.map((match, index) => (
          <div
            key={match.name}
            className="rounded-[0.875rem] border-2 border-primary bg-card p-5"
          >
            <div className="flex gap-4">
              <Avatar name={match.name} />
              <div>
                <p className="font-black">{match.name}</p>
                <p className="text-sm text-charcoal">
                  {match.title}, {match.company}
                </p>
                <p className="mt-3 rounded-full border-2 border-primary bg-warm px-3 py-1 text-xs font-bold text-charcoal">
                  {met.includes(match.name) ? "Marked met" : "Not met yet"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-charcoal">
              Follow-up suggestion: send a concise note referencing{" "}
              {match.goals[0].toLowerCase()} and one next step.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="quiet" size="sm" onClick={() => recordConnectionAction(match, "linkedin_click", { source: "saved_connections" })}>
                <LinkIcon /> LinkedIn
              </Button>
              <Button variant="hero" size="sm" onClick={() => {
                void recordConnectionAction(match, "draft_followup");
                go("concierge");
              }}>
                Draft follow-up
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AdminDashboard({
  go,
  recordAdminAction,
}: {
  go: (screen: Screen) => void;
  recordAdminAction: (actionType: string, label: string, context?: object) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 rounded-[0.875rem] border-2 border-primary bg-background p-4 shadow-soft lg:grid-cols-[220px_1fr] lg:gap-0 lg:p-0">
      <aside className="rounded-[0.875rem] border-2 border-primary bg-card p-5 lg:rounded-none lg:border-0 lg:border-r-2">
        <p className="font-label text-3xl">OOO Admin</p>
        <div className="mt-8 grid gap-3 text-sm font-bold">
          {[
            "Event Manager",
            "Attendees",
            "Matching",
            "Reports",
            "Data Model",
          ].map((item) => (
            <button
              key={item}
              onClick={() => item === "Data Model" ? go("dataModel") : recordAdminAction("admin_nav", item)}
              className="rounded-full border-2 border-primary bg-background px-4 py-3 text-left text-charcoal hover:bg-aqua hover:text-foreground"
            >
              {item}
            </button>
          ))}
        </div>
      </aside>
      <div className="grid gap-6 p-5 sm:p-8">
        <Panel className="bg-aqua text-aqua-foreground">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase opacity-70">
                Beta
              </p>
              <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                {demoEvent.name}
              </h1>
              <p className="mt-3 text-charcoal">
                {demoEvent.location} · {demoEvent.sponsors.length} enterprise
                sponsors · {demoEvent.attendees} attendees
              </p>
            </div>
            <Button variant="hero" onClick={() => go("sponsor")}>
              Open LinkedIn sponsor view
            </Button>
          </div>
        </Panel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardMetrics.map(([label, value, Icon]) => (
            <Stat
              key={label as string}
              label={label as string}
              value={value as string}
              icon={Icon as typeof Users}
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <h2 className="text-2xl font-black">Event Manager</h2>
            <div className="mt-5 grid gap-4">
              <Field label="Event Name" placeholder={demoEvent.name} />
              <Field label="Date" type="date" />
              <Field label="Venue" placeholder={demoEvent.location} />
              <Field
                label="Sponsor List"
                placeholder={demoEvent.sponsors.join(", ")}
              />
              <Field label="Event Code" />
              <Button variant="quiet" className="justify-start" onClick={() => recordAdminAction("generate_qr", "QR Code") }>
                <QrCode /> QR Code placeholder
              </Button>
              <Button variant="hero" onClick={() => recordAdminAction("upload_csv", "Upload CSV attendees") }>
                <Upload /> Upload CSV attendees
              </Button>
            </div>
          </Panel>
          <Panel>
            <h2 className="text-2xl font-black">Attendee Manager</h2>
            <div className="mt-5 grid gap-4">
              <label className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-charcoal" />
                <input
                  placeholder="Search attendees"
                  className="h-12 w-full rounded-xl border-2 border-primary bg-card pl-12 pr-4 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Role type",
                  "Hiring",
                  "Looking for jobs",
                  "Founder",
                  "Investor",
                  "Checked in",
                ].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => recordAdminAction("attendee_filter", filter)}
                    className="rounded-full border-2 border-primary bg-warm px-4 py-2 text-sm font-bold text-charcoal"
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <h2 className="mt-8 text-2xl font-black">Match Controls</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ink" onClick={() => recordAdminAction("matching", "Run Matching Engine")}>Run Matching Engine</Button>
              <Button variant="quiet" onClick={() => recordAdminAction("matching", "Refresh Matches")}>Refresh Matches</Button>
              <Button variant="hero" onClick={() => recordAdminAction("matching", "Manual VIP Match Boost")}>Manual VIP Match Boost</Button>
            </div>
            <h2 className="mt-8 text-2xl font-black">Reporting</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "Attendee CSV",
                "Lead CSV",
                "Sponsor Leads",
                "Engagement Metrics",
                "Check-in Report",
              ].map((item) => (
                <Button key={item} variant="quiet" size="sm" onClick={() => recordAdminAction("export", item)}>
                  <Download />
                  {item}
                </Button>
              ))}
            </div>
            <Button
              className="mt-6"
              variant="quiet"
              onClick={() => go("dataModel")}
            >
              <Database /> Data Model
            </Button>
          </Panel>
        </div>
        <AnalyticsLog />
      </div>
    </div>
  );
}

function SponsorDashboard({
  recordAdminAction,
}: {
  recordAdminAction: (actionType: string, label: string, context?: object) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 rounded-[0.875rem] border-2 border-primary bg-aqua p-4 shadow-soft sm:p-6">
      <Panel className="bg-card text-foreground">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-vermillion">
              LinkedIn Sponsor Dashboard
            </p>
            <h1 className="mt-3 text-4xl font-black sm:text-6xl">
              Talent intelligence for {demoEvent.name}
            </h1>
            <div className="mt-5 flex flex-wrap gap-2">
              {sponsorGoals.map((goal) => (
                <span
                  key={goal}
                  className="rounded-full border-2 border-primary bg-card px-3 py-1 text-xs font-bold text-foreground"
                >
                  {goal}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[0.875rem] border-2 border-primary bg-card p-5 text-sm font-bold leading-6 text-charcoal shadow-card">
            LinkedIn surfaced 42 qualified talent leads, 18 high-intent
            conversations, and 9 marked meetings.
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Leads surfaced", "42", Target],
          ["Talent leads", "42", BriefcaseBusiness],
          ["High-intent conversations", "18", CircleDollarSign],
          ["Saved prospects", "31", Network],
          ["Meetings marked met", "9", Check],
          ["Employer brand engagement", "64%", BarChart3],
        ].map(([label, value, Icon]) => (
          <Stat
            key={label as string}
            label={label as string}
            value={value as string}
            icon={Icon as typeof Users}
          />
        ))}
      </div>
      <Panel className="bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-black">LinkedIn Lead Feed</h1>
          <div className="flex flex-wrap gap-2">
            {[
              "Hiring candidates",
              "Buyers",
              "Founders",
              "Investors",
              "Creators",
            ].map((filter) => (
              <span
                key={filter}
                className="rounded-full border-2 border-primary bg-warm px-3 py-1 text-xs font-bold text-charcoal"
              >
                {filter}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {sponsorLeads.map((lead) => (
            <div
              key={lead.name}
              className="rounded-[0.875rem] border-2 border-primary bg-card p-5 transition hover:-translate-y-1 hover:shadow-card"
            >
              <p className="font-black">{lead.name}</p>
              <p className="text-sm text-charcoal">
                {lead.title}, {lead.company}
              </p>
              <p className="mt-3 text-sm leading-6">{lead.why}</p>
              <div className="mt-4 flex gap-2">
                <Button variant="quiet" size="sm" onClick={() => recordAdminAction("sponsor_lead", `LinkedIn ${lead.name}`, { company: lead.company })}>
                  LinkedIn
                </Button>
                <select className="rounded-xl border border-border bg-card px-3 text-sm font-bold" onChange={(event) => recordAdminAction("sponsor_status", `${lead.name}: ${event.target.value}`)}>
                  <option>{lead.status}</option>
                  <option>New</option>
                  <option>Saved</option>
                  <option>Met</option>
                  <option>Follow-up</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="bg-citron text-citron-foreground">
        <h2 className="text-2xl font-black">ROI Summary</h2>
        <p className="mt-3 max-w-3xl text-lg font-bold leading-8">
          LinkedIn surfaced 42 qualified talent leads, 18 high-intent
          conversations, and 9 marked meetings.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-5">
          {[
            "Leads generated",
            "Meetings completed",
            "Check-ins reached",
            "Profile engagement",
            "Follow-up interest",
          ].map((item, index) => (
            <div
              key={item}
              className="rounded-[0.875rem] border-2 border-primary bg-card p-4"
            >
              <p className="text-2xl font-black">
                {[42, 9, 618, 64, 18][index]}
                {index > 2 ? "%" : ""}
              </p>
              <p className="text-xs text-charcoal">{item}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function OrganizerDashboard({
  recordAdminAction,
}: {
  recordAdminAction: (actionType: string, label: string, context?: object) => Promise<void>;
}) {
  const items = [
    ["Event registrations", "752"],
    ["Attendance/check-ins", "618"],
    ["Most common goals", "Hiring + partnerships"],
    ["Top industries", "SaaS, commerce, media"],
    ["Match engagement", "71%"],
    ["Sponsor engagement", "38%"],
    ["Concierge usage", "412"],
    ["Sentiment placeholder", "Positive"],
    ["NPS placeholder", "+48"],
  ];
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, value]) => (
          <Panel key={label} className="p-5">
            <p className="text-3xl font-black leading-none sm:text-4xl">
              {value}
            </p>
            <p className="mt-2 text-sm font-semibold text-charcoal">{label}</p>
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-black">Organizer Intelligence</h1>
          <Button variant="hero" onClick={() => recordAdminAction("export", "Organizer Intelligence report")}>
            <Download /> Export report
          </Button>
        </div>
        <div className="mt-6 grid gap-3">
          {[82, 67, 59, 44].map((value, index) => (
            <div
              key={value}
              className="rounded-[0.875rem] border-2 border-primary bg-card p-4"
            >
              <div className="mb-2 flex justify-between text-sm font-bold">
                <span>
                  {
                    [
                      "Hiring outcomes",
                      "Pipeline creation",
                      "Partnership intent",
                      "Creator deal flow",
                    ][index]
                  }
                </span>
                <span>{value}%</span>
              </div>
              <div className="h-3 rounded-full border-2 border-primary bg-warm">
                <div
                  className="h-3 rounded-full bg-aqua"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Integrations() {
  return (
    <Panel>
      <h1 className="text-4xl font-black">Integrations</h1>
      <p className="mt-2 text-charcoal">
        MVP-ready import/export now, APIs and automations next.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((name, index) => (
          <div
            key={name}
            className="rounded-[0.875rem] border-2 border-primary bg-card p-5 transition hover:-translate-y-1"
          >
            <p className="text-xl font-black">{name}</p>
            <div className="mt-4 space-y-2 text-sm font-bold text-charcoal">
              <p>CSV Import / Export Ready</p>
              <p>API Integration Coming Soon</p>
              <p>Zapier/Webhook Compatible</p>
            </div>
            <span className="mt-5 inline-flex rounded-full bg-warm px-3 py-1 text-xs font-black text-warm-foreground">
              Phase {index < 5 ? "1" : "2"}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DataModel() {
  return (
    <Panel>
      <h1 className="text-4xl font-black">Admin Data Model</h1>
      <p className="mt-2 text-charcoal">
        Core tables for the OOO Intelligence MVP.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dataTables.map((table) => (
          <div
            key={table}
            className="flex items-center gap-3 rounded-xl border-2 border-primary bg-card p-4"
          >
            <Database className="h-5 w-5 text-charcoal" />
            <span className="font-mono text-sm font-bold">{table}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AnalyticsLog() {
  return (
    <Panel>
      <h2 className="mb-4 text-2xl font-black">Analytics Event Log</h2>
      <div className="grid gap-2">
        {analyticsEvents.map((event, index) => (
          <div
            key={event}
            className="flex items-center justify-between rounded-xl border-2 border-primary bg-card px-4 py-3 text-sm"
          >
            <span className="font-bold">{event}</span>
            <span className="text-charcoal">T+{index + 2}m</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <div
      className={`${large ? "h-28 w-28 text-3xl" : "h-16 w-16 text-lg"} flex shrink-0 items-center justify-center rounded-3xl bg-ink-gradient font-black text-primary-foreground shadow-card`}
    >
      {initials(name)}
    </div>
  );
}

function Info({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-[0.875rem] border-2 border-primary bg-card p-5">
      <p className="font-black">{title}</p>
      <p className="mt-3 text-sm leading-6 text-charcoal">{copy}</p>
    </div>
  );
}

export default Index;
