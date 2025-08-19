// ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { useEffect, useState } from "react";

export default function ProtectedRoute({ children, requireVerified = false }) {
  const [state, setState] = useState({ loading: true, authed: false, verified: false });

  useEffect(() => {
    const auth = getAuth();
    const off = onAuthStateChanged(auth, (user) => {
      const verified = !!user?.emailVerified || user?.providerData?.some(p => p.providerId !== "password");
      setState({ loading: false, authed: !!user, verified });
    });
    return () => off();
  }, []);

  if (state.loading) return null; // tai pieni loader
  if (!state.authed) return <Navigate to="/login" replace />;
  if (requireVerified && !state.verified) return <Navigate to="/login" replace />;
  return children;
}
