import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar.js";
import { LandingPage } from "./pages/LandingPage.js";
import { MapPage } from "./pages/MapPage.js";
import { MissionPage } from "./pages/MissionPage.js";
import { OperationsPage } from "./pages/OperationsPage.js";
import { SciencePage } from "./pages/SciencePage.js";
import { MethodologyPage } from "./pages/MethodologyPage.js";
import { MissionReplayPage } from "./pages/MissionReplayPage.js";
import { MissionAnalyticsPage } from "./pages/MissionAnalyticsPage.js";
import { JudgingDemoPage } from "./pages/JudgingDemoPage.js";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/replay" element={<MissionReplayPage />} />
            <Route path="/mission-analytics" element={<MissionAnalyticsPage />} />
            <Route path="/demo" element={<JudgingDemoPage />} />
            <Route path="/mission" element={<MissionPage />} />
            <Route path="/science" element={<SciencePage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};
