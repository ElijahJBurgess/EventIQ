import { Link } from "react-router-dom";
import { Handshake, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: UserRound,
    title: "Build your profile",
    description: "Tell us who you are, what you're looking for, and who you want to meet.",
    accent: "bg-aqua text-aqua-foreground",
  },
  {
    icon: Sparkles,
    title: "Get matched instantly",
    description: "Our AI analyzes everyone attending and finds your strongest connections.",
    accent: "bg-citron text-citron-foreground",
  },
  {
    icon: Handshake,
    title: "Connect at the event",
    description: "Request to connect, and meet the right people in person.",
    accent: "bg-vermillion text-vermillion-foreground",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-aqua">
      <header className="sticky top-0 z-20 border-b-2 border-primary bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-display text-lg">OOO</span>
          <Button asChild variant="quiet" size="sm">
            <Link to="/v2/auth">Sign In</Link>
          </Button>
        </div>
      </header>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">
            Meet the right people at Render ATL
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base normal-case font-sans leading-7 text-charcoal sm:text-lg">
            OOO Intelligence uses AI to match you with the people at the event who are worth
            meeting, based on your goals, not just your title.
          </p>
          <div className="mt-10">
            <Button asChild variant="hero" size="lg" className="h-14 px-10 text-base sm:text-lg">
              <Link to="/v2/auth?mode=signup">Get Matched</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-card px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="ooo-card bg-warm p-6">
                <span className="font-label text-xs text-charcoal">Step {index + 1}</span>
                <div
                  className={`mb-5 mt-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary ${step.accent}`}
                >
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg">{step.title}</h3>
                <p className="mt-2 text-sm normal-case font-sans leading-6 text-charcoal">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary px-4 py-16 text-primary-foreground sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-4xl">Networking without the guesswork</h2>
          <p className="mt-6 normal-case font-sans text-sm leading-7 text-primary-foreground/80 sm:text-base">
            Most conference networking is random — you talk to whoever happens to be standing
            near you and hope for the best. OOO Intelligence changes that. Before you even walk
            in the room, we show you exactly who you should meet and why.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl sm:text-5xl">Ready to meet your people?</h2>
          <div className="mt-8">
            <Button asChild variant="hero" size="lg" className="h-14 px-10 text-base sm:text-lg">
              <Link to="/v2/auth?mode=signup">Get Matched</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs normal-case font-sans text-charcoal">
            Free to join · Takes 2 minutes
          </p>
        </div>
      </section>

      <footer className="border-t-2 border-primary bg-card px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center">
          <span className="font-display text-base">OOO</span>
          <p className="text-xs normal-case font-sans text-muted-foreground">
            Built for Render ATL 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
