import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./App.tsx";
import "./styles.css";
import "./cards.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
