import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Tenders from "./pages/Tenders";
import Analytics from "./pages/Analytics";
import Sync from "./pages/Sync";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tenders" element={<Tenders />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="sync" element={<Sync />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
