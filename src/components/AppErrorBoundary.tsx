import { Component, type ReactNode } from "react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Error objects and component stacks may contain user data or credentials.
    console.error("Application render failed; recovery screen displayed.");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" style={{ maxWidth: "32rem", margin: "15vh auto", padding: "1.5rem", fontFamily: "system-ui, sans-serif", color: "#202020", background: "#fff", textTransform: "none" }}>
        <h1 style={{ fontFamily: "inherit", fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.3, textTransform: "none", letterSpacing: "normal" }}>Something went wrong</h1>
        <p style={{ margin: "1rem 0 1.5rem", lineHeight: 1.6 }}>Please reload to try again, or return to the home page.</p>
        <button type="button" style={{ minHeight: 44, padding: "0.65rem 1rem", border: "1px solid #202020", borderRadius: "0.375rem", background: "#202020", color: "#fff", font: "inherit", textTransform: "none", cursor: "pointer" }} onClick={() => window.location.reload()}>Reload</button>{" "}
        <a href="/" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, marginLeft: "1rem", color: "#202020", textDecoration: "underline" }}>Go to home</a>
      </main>
    );
  }
}
