import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  const role = String(user?.role || "user").toLowerCase();
  const allowed = role === "admin" || role === "mod";

  if (!allowed) {
    return <Navigate to="/home" replace state={{ from: location }} />;
  }

  return children;
}