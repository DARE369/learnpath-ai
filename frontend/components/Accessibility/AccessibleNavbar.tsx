import React, { useRef, useState } from "react";
import Link from "next/link";
import { manageFocus, ARIA_LABELS } from "@/lib/accessibility";

interface NavLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface AccessibleNavbarProps {
  title: string;
  links: NavLink[];
  onMenuToggle?: (isOpen: boolean) => void;
}

export function AccessibleNavbar({ title, links, onMenuToggle }: AccessibleNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusManager = useRef(
    manageFocus({
      trap: menuRef.current || undefined,
      initialFocus: menuRef.current?.querySelector("a") as HTMLElement,
      returnFocus: true,
    })
  );

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
    onMenuToggle?.(!isMenuOpen);

    if (!isMenuOpen) {
      setTimeout(() => focusManager.current.start(), 0);
    } else {
      focusManager.current.restore();
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    focusManager.current.trap(e as any);

    if (e.key === "Escape") {
      setIsMenuOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
    focusManager.current.restore();
  };

  return (
    <nav
      className="accessible-navbar"
      aria-label="Main navigation"
      role="navigation"
    >
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link href="/">
            <a className="brand-link">
              <span className="brand-title">{title}</span>
            </a>
          </Link>
        </div>

        <button
          ref={triggerRef}
          className="menu-trigger"
          onClick={handleMenuToggle}
          aria-expanded={isMenuOpen}
          aria-controls="navbar-menu"
          aria-label={ARIA_LABELS.menu}
        >
          <span className="menu-icon">
            <span className="menu-line"></span>
            <span className="menu-line"></span>
            <span className="menu-line"></span>
          </span>
        </button>

        <div
          ref={menuRef}
          id="navbar-menu"
          className={`navbar-menu ${isMenuOpen ? "open" : ""}`}
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <a
                className="nav-link"
                role="menuitem"
                onClick={handleLinkClick}
              >
                {link.icon && <span className="nav-icon">{link.icon}</span>}
                <span className="nav-label">{link.label}</span>
              </a>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .accessible-navbar {
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .navbar-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 20px;
          max-width: 1280px;
          margin: 0 auto;
          height: 60px;
        }

        .navbar-brand {
          flex: 1;
        }

        .brand-link {
          display: flex;
          align-items: center;
          text-decoration: none;
          color: #1f2937;
          font-weight: 600;
          font-size: 18px;
          padding: 8px;
          border-radius: 4px;
          focus: {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
          }
        }

        .brand-link:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .brand-title {
          white-space: nowrap;
        }

        .menu-trigger {
          display: none;
          flex-direction: column;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          margin-right: -8px;
        }

        .menu-trigger:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 4px;
        }

        .menu-icon {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .menu-line {
          width: 24px;
          height: 2px;
          background: #1f2937;
          transition: all 0.3s ease;
        }

        .menu-trigger[aria-expanded="true"] .menu-line:nth-child(1) {
          transform: rotate(45deg) translate(8px, 8px);
        }

        .menu-trigger[aria-expanded="true"] .menu-line:nth-child(2) {
          opacity: 0;
        }

        .menu-trigger[aria-expanded="true"] .menu-line:nth-child(3) {
          transform: rotate(-45deg) translate(7px, -7px);
        }

        .navbar-menu {
          display: flex;
          gap: 4px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          color: #1f2937;
          text-decoration: none;
          border-radius: 4px;
          transition: background-color 0.2s;
          font-size: 14px;
          font-weight: 500;
        }

        .nav-link:hover {
          background-color: #f3f4f6;
        }

        .nav-link:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }

        .nav-icon {
          display: inline-flex;
          align-items: center;
        }

        .nav-label {
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .menu-trigger {
            display: flex;
          }

          .navbar-menu {
            position: absolute;
            top: 60px;
            left: 0;
            right: 0;
            flex-direction: column;
            background: white;
            border-bottom: 1px solid #e5e7eb;
            padding: 12px 0;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
          }

          .navbar-menu.open {
            max-height: 500px;
          }

          .nav-link {
            width: 100%;
            padding: 12px 20px;
            border-radius: 0;
          }
        }
      `}</style>
    </nav>
  );
}
