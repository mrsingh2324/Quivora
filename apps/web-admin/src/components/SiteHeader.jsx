import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function SiteHeader({ variant = "dark" }) {
  const { user } = useAuth();
  const { onLogout } = useOutletContext() || {};
  const location = useLocation();
  const isLight = variant === "light";
  const [profileOpen, setProfileOpen] = useState(false);
  const accountRef = useRef(null);
  const roleLabel = user?.role === "admin_player" ? "Admin + Player" : user?.role || "admin";

  useEffect(() => {
    if (!profileOpen) return undefined;

    function handlePointerDown(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [profileOpen]);

  return (
    <header className={isLight ? "site-header light" : "site-header dark"}>
      <Link className="site-brand" to="/">
        <img className="workspace-logo" src="/quivora-icon.svg" alt="" />
        <strong>Quivora</strong>
      </Link>

      <nav className="site-nav" aria-label="Site navigation">
        <Link className={location.pathname === "/" ? "active" : ""} to="/">My Workspace</Link>
        <Link className={location.pathname === "/build" ? "active site-build-link" : "site-build-link"} to="/build">Build Quiz</Link>
        <Link className={location.pathname === "/templates" ? "active" : ""} to="/templates">Templates⌄</Link>
        <Link className={location.pathname === "/products" ? "active" : ""} to="/products">Products⌄</Link>
        <Link className={location.pathname === "/question-bank" ? "active" : ""} to="/question-bank">Question Bank</Link>
        <Link className={location.pathname === "/assignments" ? "active" : ""} to="/assignments">Assignments</Link>
        <Link className={location.pathname === "/team-workspace" ? "active" : ""} to="/team-workspace">Team</Link>
        <Link className={location.pathname === "/integrations" ? "active" : ""} to="/integrations">Integrations</Link>
        <Link className={location.pathname.startsWith("/support") ? "active" : ""} to="/support/help-center">Support⌄</Link>
      </nav>

      <div className="site-actions" ref={accountRef}>
        <button
          className="workspace-avatar-button"
          type="button"
          onClick={() => setProfileOpen((value) => !value)}
          aria-expanded={profileOpen}
        >
          <span className="workspace-avatar">{(user?.name || "A")[0].toUpperCase()}</span>
        </button>
        {profileOpen ? (
          <div className="profile-menu">
            <div className="profile-menu-head">
              <div className="workspace-avatar">{(user?.name || "A")[0].toUpperCase()}</div>
              <div>
                <p>Hello,</p>
                <strong>{user?.name || "Admin"}</strong>
              </div>
              <span>{roleLabel}</span>
            </div>
            <Link to="/account/profile">Profile</Link>
            <Link to="/account/admin-player">Admin + Player</Link>
            <Link to="/account/settings">Settings</Link>
            <Link to="/account/admin-console">Admin Console</Link>
            <Link to="/account/support-requests">Support Requests</Link>
            {onLogout ? <button type="button" onClick={onLogout}>Logout</button> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default SiteHeader;
