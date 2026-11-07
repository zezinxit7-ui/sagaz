import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "@/app/App";
import { ensureSeeded } from "@/data/db";

async function boot(): Promise<void> {
  await ensureSeeded();
  const container = document.getElementById("root");
  if (!container) throw new Error("#root não encontrado");
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
