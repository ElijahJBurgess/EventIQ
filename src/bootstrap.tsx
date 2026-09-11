import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

export function mountApp(root: HTMLElement): void {
  createRoot(root).render(<AppErrorBoundary><App /></AppErrorBoundary>);
}
