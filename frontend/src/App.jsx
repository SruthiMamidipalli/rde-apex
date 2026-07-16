import { Routes, Route } from "react-router-dom";
import { StoreProvider, Toast } from "./lib/store.jsx";
import Layout from "./components/Layout.jsx";
import Chatbot from "./components/Chatbot.jsx";

import CommandCenter from "./pages/CommandCenter.jsx";
import AtRiskQueue from "./pages/AtRiskQueue.jsx";
import Customer360 from "./pages/Customer360.jsx";
import RetentionBriefPage from "./pages/RetentionBriefPage.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import ImpactRoi from "./pages/ImpactRoi.jsx";
import CostAnalytics from "./pages/CostAnalytics.jsx";
import AdminGovernance from "./pages/AdminGovernance.jsx";

export default function App() {
  return (
    <StoreProvider>
      <Layout>
        <Routes>
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
        </Routes>
      </Layout>
      <Chatbot />
      <Toast />
    </StoreProvider>
  );
}
