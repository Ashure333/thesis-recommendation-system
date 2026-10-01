import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme";
import { PipelineModeProvider } from "./state/pipelineMode";
import { HuntProvider } from "./state/hunt";
import { AchievementsProvider } from "./state/achievements";
import { LayoutPrefsProvider } from "./state/layoutPrefs";
import { PetFormProvider } from "./state/petForm";
// @ts-ignore: CSS is handled by the bundler at runtime.
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <HuntProvider>
        <AchievementsProvider>
          <PipelineModeProvider>
            <LayoutPrefsProvider>
              <PetFormProvider>
                <App />
              </PetFormProvider>
            </LayoutPrefsProvider>
          </PipelineModeProvider>
        </AchievementsProvider>
      </HuntProvider>
    </ThemeProvider>
  </React.StrictMode>
);
