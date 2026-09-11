import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import EditProfileScreen from "./EditProfileScreen";

// The in-memory persistence boundary models updates followed by fresh selects;
// editor hydration, validation, question rendering, and saving are real.
const database = vi.hoisted(() => ({ row: {} as Record<string, unknown> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`);
      return {
        select: (columns: string) => ({ eq: () => ({ maybeSingle: async () => ({ data: Object.fromEntries(columns.split(",").map((column) => [column, database.row[column]])), error: null }) }) }),
        update: (payload: Record<string, unknown>) => ({ eq: async () => {
          database.row = { ...database.row, ...payload };
          return { error: null };
        } }),
      };
    },
    rpc: async (_name: string, args: { search_query: string }) => ({ data: args.search_query === "Portland" ? [{ id: 1, city: "Portland", state_code: "ME", display_name: "Portland, ME" }] : [], error: null }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  },
}));

afterEach(cleanup);

function persistedProfile(roleType: string) {
  return {
    full_name: "Jordan Lee", avatar_url: "https://example.com/photo.jpg", title: "VP Engineering",
    company: "TechCo", location: "Atlanta, GA", linkedin_url: "https://linkedin.com/in/jordanlee",
    role_type: roleType, secondary_role_types: ["Corporate Professional"], primary_function: "Product",
    additional_functions: ["Engineering"], seniority: "Director", primary_goal: "Build Community",
    secondary_goals: ["Expand Network"], needs: ["Hiring Talent"], offers: ["Career Advice"],
    who_to_meet: ["Founders"], industry_preference: "Show me a mix of both", location_preference: "mix",
    career_level_preference: ["Director"], connection_preference: ["Quick Introduction"],
    role_details: {}, profile_completion_score: 80, profile_completed: true,
  };
}

async function openQuestions() {
  await screen.findByDisplayValue("Jordan Lee");
  for (let page = 1; page <= 3; page++) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("button", { name: "Save Changes" });
}

it.each(["Founder / Co-founder", "Creator / Influencer"])("%s saves corrected completion and retains it after reload", async (roleType) => {
  database.row = { ...persistedProfile(roleType), role_details: { Founder: { companyStage: "Seed" }, Creator: { contentCategories: ["Music"] } } };
  const onSaved = vi.fn();
  const editor = () => <MemoryRouter><EditProfileScreen userId="u1" onClose={vi.fn()} onSaved={onSaved} /></MemoryRouter>;
  const first = render(editor());
  await openQuestions();
  expect(screen.getByText("No additional questions for your role — you're ready to move on.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(database.row).toMatchObject({ profile_completion_score: 100, profile_completed: true, role_details: {} });
  first.unmount();
  render(editor());
  await openQuestions();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
  expect(database.row).toMatchObject({ profile_completion_score: 100, role_details: {} });
});

it.each([
  { location: "Atlanta, GA", location_city: "Atlanta", location_state_code: "GA" },
  { location: "Paris, France", location_city: null, location_state_code: null },
])("preserves untouched persisted location $location through unrelated edits and reload", async (location) => {
  database.row = { ...persistedProfile("Creator / Influencer"), ...location };
  const onSaved = vi.fn();
  const editor = () => <MemoryRouter><EditProfileScreen userId="u1" onClose={vi.fn()} onSaved={onSaved} /></MemoryRouter>;
  const first = render(editor());
  await screen.findByDisplayValue("Jordan Lee");
  fireEvent.change(screen.getByPlaceholderText("Where do you work or build?"), { target: { value: "New company" } });
  await openQuestions();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(database.row).toMatchObject({ ...location, company: "New company" });
  first.unmount();
  render(editor());
  await screen.findByDisplayValue(location.location);
  await openQuestions();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
  expect(database.row).toMatchObject(location);
});

it("saves a new city selection and reloads both structured fields", async () => {
  database.row = { ...persistedProfile("Creator / Influencer"), location_city: "Atlanta", location_state_code: "GA" };
  const onSaved = vi.fn();
  const editor = () => <MemoryRouter><EditProfileScreen userId="u1" onClose={vi.fn()} onSaved={onSaved} /></MemoryRouter>;
  const first = render(editor());
  await screen.findByDisplayValue("Jordan Lee");
  fireEvent.change(screen.getByPlaceholderText("Search for a US city"), { target: { value: "Portland" } });
  fireEvent.click(await screen.findByRole("button", { name: "Portland, ME" }));
  await openQuestions();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(database.row).toMatchObject({ location: "Portland, ME", location_city: "Portland", location_state_code: "ME" });
  first.unmount();
  render(editor());
  await screen.findByDisplayValue("Portland, ME");
  await openQuestions();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
  expect(database.row).toMatchObject({ location_city: "Portland", location_state_code: "ME" });
});

it("clears the structured pair for an explicit custom location and preserves it after reload", async () => {
  database.row = { ...persistedProfile("Creator / Influencer"), location_city: "Atlanta", location_state_code: "GA" };
  const onSaved = vi.fn();
  const editor = () => <MemoryRouter><EditProfileScreen userId="u1" onClose={vi.fn()} onSaved={onSaved} /></MemoryRouter>;
  const first = render(editor());
  await screen.findByDisplayValue("Jordan Lee");
  fireEvent.change(screen.getByPlaceholderText("Search for a US city"), { target: { value: "Paris, France" } });
  fireEvent.click(await screen.findByRole("button", { name: /I don't see my city/ }));
  await openQuestions();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(database.row).toMatchObject({ location: "Paris, France", location_city: null, location_state_code: null });
  first.unmount();
  render(editor());
  await screen.findByDisplayValue("Paris, France");
  await openQuestions();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
  expect(database.row).toMatchObject({ location: "Paris, France", location_city: null, location_state_code: null });
});
