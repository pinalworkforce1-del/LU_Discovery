import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DiscoveryExperience } from "@/components/discovery-experience";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DiscoveryExperience />
  </StrictMode>,
);
