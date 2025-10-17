import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatPage from "./ChatPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        {/* можно будет добавить и другие страницы, например FAQ, Login и т.п. */}
      </Routes>
    </Router>
  );
}
