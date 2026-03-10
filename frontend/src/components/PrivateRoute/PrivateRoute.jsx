import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Loading from "../Loading/Loading";

/**
 * A private route component that protects routes from unauthenticated access.
 * It checks if the user is authenticated and redirects them to the login page if they are not.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to render if the user is authenticated.
 * @returns {React.ReactElement} - Renders the child components if the user is authenticated, otherwise redirects to the login page. It shows a loading spinner while checking the authentication status.
 */
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default PrivateRoute;
