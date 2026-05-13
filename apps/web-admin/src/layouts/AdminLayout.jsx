import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { disconnectAdminSocket } from "../services/socket";

function AdminLayout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    setTransitioning(true);
    const timer = setTimeout(() => setTransitioning(false), 420);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  function handleLogout() {
    disconnectAdminSocket();
    logout();
  }

  return (
    <>
      {transitioning ? (
        <div className="route-transition-loader">
          <span />
          <strong>Loading workspace</strong>
        </div>
      ) : null}
      <Outlet context={{ onLogout: handleLogout }} />
    </>
  );
}

export default AdminLayout;
