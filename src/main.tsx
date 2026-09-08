import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DiscoveryExperience } from "@/components/discovery-experience";
import "./index.css";
import "./level-up-standard.css";
import "./level-up-standard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DiscoveryExperience />
  </StrictMode>,
);
