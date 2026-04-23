/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import Layout from "./Layout";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import OverallSchedule from "./pages/OverallSchedule";
import RoomSearch from "./pages/RoomSearch";
import LongTerm from "./pages/LongTerm";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<OverallSchedule myOnly={true} />} />
            <Route path="overall" element={<OverallSchedule />} />
            <Route path="search" element={<RoomSearch />} />
            <Route path="longterm" element={<LongTerm />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
