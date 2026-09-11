import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ProfileSetupPageProps } from "@/components/profile-setup/types";
import ProfileSetup from "./ProfileSetup";

const state = vi.hoisted(() => ({ role: "Founder / Co-founder", saved: null as Record<string, unknown> | null }));
vi.mock("@/v2/AuthProvider", () => ({ useAuth: () => ({ user: { id: "test-user" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: (payload: Record<string, unknown>) => ({
    eq: async () => { state.saved = payload; return { error: null }; },
  }) }) },
}));
// Only replace unrelated wizard pages; retain the real question screen,
// submission handler, cleanup and payload builder.
vi.mock("@/components/profile-setup/Page1BasicInfo", () => ({
  default: ({ setFormData, onNext }: ProfileSetupPageProps) => <button onClick={() => {
    setFormData(prev => ({ ...prev, fullName: "Test Person", roleType: state.role,
      secondaryRoleTypes: ["Corporate Professional"], primaryGoal: "Build Community",
      secondaryGoals: ["Meet Collaborators"], whoToMeet: ["Founders"], offers: ["Advice"],
      location: "Atlanta, GA", locationCity: "Atlanta", locationStateCode: "GA",
      locationSelectionType: "database", roleDetails: { Creator: { contentCategories: ["Tech"] } },
    }));
    onNext();
  }}>Complete basics</button>,
}));
vi.mock("@/components/profile-setup/Page2Goals", () => ({ default: ({ onNext }: ProfileSetupPageProps) => <button onClick={onNext}>Complete goals</button> }));
vi.mock("@/components/profile-setup/Page3WhoAndFilters", () => ({ default: ({ onNext }: ProfileSetupPageProps) => <button onClick={onNext}>Complete filters</button> }));
vi.mock("@/components/profile-setup/Page4Terms", () => ({ default: ({ onSubmit }: { onSubmit: () => void }) => <button onClick={onSubmit}>Submit profile</button> }));
vi.mock("@/components/profile-setup/Page5EventSelection", () => ({ default: () => <p>Choose an event</p> }));
afterEach(cleanup);
beforeEach(() => { state.saved = null; });

describe("ProfileSetup submission", () => {
  it.each(["Founder / Co-founder", "Creator / Influencer"])("saves 100 for %s when no questions apply", async role => {
    state.role = role;
    render(<MemoryRouter><ProfileSetup /></MemoryRouter>);
    fireEvent.click(screen.getByText("Complete basics"));
    fireEvent.click(screen.getByText("Complete goals"));
    fireEvent.click(screen.getByText("Complete filters"));
    expect(screen.getByText("No additional questions for your role — you're ready to move on.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByText("Submit profile"));
    await waitFor(() => expect(state.saved).toMatchObject({ profile_completion_score: 100, profile_completed: true, role_details: {}, location: "Atlanta, GA", location_city: "Atlanta", location_state_code: "GA" }));
    expect(await screen.findByText("Choose an event")).toBeInTheDocument();
  });
});
