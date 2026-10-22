import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import FormManager from "./components/FormManager";

// Public nomination form. The admin panel is a separate app (../admin).
export default function App() {
  return (
    <div className="relative antialiased selection:bg-slate-900 selection:text-white">
      <Routes>
        <Route path="/" element={<FormManager />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
