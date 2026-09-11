type QuestionType = "Founder" | "Investor" | "Recruiter" | "Creator" | "CareerSeeker";

export interface QuestionBlock {
  type: QuestionType;
  label: string;
  storageKey: string;
}

export function getQuestionBlocks(
  primaryRole: string,
  secondaryRoles: string[],
  primaryGoal: string,
  secondaryGoals: string[],
): QuestionBlock[] {
  const identities = Array.from(new Set([primaryRole, ...secondaryRoles].filter(Boolean)));
  const goals = new Set([primaryGoal, ...secondaryGoals].filter(Boolean));
  const hasRecruiter = identities.includes("Recruiter");
  const hasHiringManager = identities.includes("Hiring Manager");
  let recruitingBlockAdded = false;

  const blocks = identities.flatMap((role): QuestionBlock[] => {
    if (role === "Founder / Co-founder") {
      return goals.has("Raise Capital") || goals.has("Find Customers or Clients")
        ? [{ type: "Founder", label: role, storageKey: "Founder" }]
        : [];
    }

    if (role === "Creator / Influencer") {
      return goals.has("Find Brand Partners")
        ? [{ type: "Creator", label: role, storageKey: "Creator" }]
        : [];
    }

    if (role === "Investor") {
      return [{ type: role, label: role, storageKey: role }];
    }

    if (role === "Recruiter" || role === "Hiring Manager") {
      if (recruitingBlockAdded) return [];
      recruitingBlockAdded = true;

      const storageKey =
        primaryRole === "Recruiter"
          ? "Recruiter"
          : primaryRole === "Hiring Manager"
            ? "Hiring Manager"
            : "Recruiter";
      const label = hasRecruiter && hasHiringManager ? "Recruiter / Hiring Manager" : role;

      return [{ type: "Recruiter", label, storageKey }];
    }

    return [];
  });

  if (goals.has("Hire Talent") && !recruitingBlockAdded) {
    blocks.push({ type: "Recruiter", label: "Hiring", storageKey: "Recruiter" });
  }

  if (goals.has("Explore Career Opportunities")) {
    blocks.push({ type: "CareerSeeker", label: "Career seeker", storageKey: "CareerSeeker" });
  }

  return blocks;
}

