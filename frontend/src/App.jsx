import { Routes, Route, Navigate } from "react-router-dom";
import { StoreProvider, Toast, useStore } from "./lib/store.jsx";
import Layout from "./components/Layout.jsx";
import Chatbot from "./components/Chatbot.jsx";
import Login from "./pages/Login.jsx";

import CommandCenter from "./pages/CommandCenter.jsx";
import AtRiskQueue from "./pages/AtRiskQueue.jsx";
import Customer360 from "./pages/Customer360.jsx";
import RetentionBriefPage from "./pages/RetentionBriefPage.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import ImpactRoi from "./pages/ImpactRoi.jsx";
import CostAnalytics from "./pages/CostAnalytics.jsx";
import AdminGovernance from "./pages/AdminGovernance.jsx";

function Shell() {
  const { persona } = useStore();

  // Mock login gate: no persona selected → force the picker.
  if (!persona) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<CommandCenter />} />
          <Route path="/queue" element={<AtRiskQueue />} />
          <Route path="/customers" element={<Customer360 />} />
          <Route path="/customers/:id" element={<Customer360 />} />
          <Route path="/brief" element={<RetentionBriefPage />} />
          <Route path="/brief/:id" element={<RetentionBriefPage />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/impact" element={<ImpactRoi />} />
          <Route path="/cost" element={<CostAnalytics />} />
          <Route path="/admin" element={<AdminGovernance />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Chatbot />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
      <Toast />
    </StoreProvider>
  );
}
