import { validatePublicEnv } from "./config/publicEnv";

type AppModule = { mountApp(root: HTMLElement): void };

export async function startApp(root: HTMLElement, load: () => Promise<AppModule>): Promise<void> {
  try {
    validatePublicEnv(import.meta.env);
    const { mountApp } = await load();
    mountApp(root);
  } catch {
    // Deliberately independent of React, CSS imports, auth and routing providers.
    const fallback = document.createElement("main");
    fallback.setAttribute("role", "alert");
    fallback.style.cssText = "max-width:32rem;margin:15vh auto;padding:1.5rem;font-family:system-ui,sans-serif;color:#202020;background:#fff;text-transform:none";
    const heading = document.createElement("h1");
    heading.textContent = "Unable to start the app";
    heading.style.cssText = "font-family:inherit;font-size:1.5rem;font-weight:600;line-height:1.3;text-transform:none;letter-spacing:normal";
    const explanation = document.createElement("p");
    explanation.textContent = "Please reload to try again, or return to the home page. If this continues, try again later.";
    explanation.style.cssText = "margin:1rem 0 1.5rem;line-height:1.6";
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "Reload";
    reload.style.cssText = "min-height:44px;padding:0.65rem 1rem;border:1px solid #202020;border-radius:0.375rem;background:#202020;color:#fff;font:inherit;text-transform:none;cursor:pointer";
    reload.addEventListener("click", () => window.location.reload());
    const home = document.createElement("a");
    home.href = "/";
    home.textContent = "Go to home";
    home.style.cssText = "display:inline-flex;align-items:center;min-height:44px;margin-left:1rem;color:#202020;text-decoration:underline";
    fallback.append(heading, explanation, reload, document.createTextNode(" "), home);
    root.replaceChildren(fallback);
    console.error("Application startup failed; recovery screen displayed.");
  }
}
