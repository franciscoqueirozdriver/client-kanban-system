'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { FaChartBar, FaUsers, FaColumns, FaCog, FaHome, FaSearchDollar } from 'react-icons/fa';

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = [
    { href: '/', label: 'Dashboard', icon: <FaHome /> },
    { href: '/clientes', label: 'Clients', icon: <FaUsers /> },
    { href: '/kanban', label: 'Kanban', icon: <FaColumns /> },
    { href: '/consultas/perdecomp-comparativo', label: 'PER/DCOMP (Comparativo)', icon: <FaSearchDollar /> },
    { href: '/reports', label: 'Reports', icon: <FaChartBar /> },
    { href: '#', label: 'Settings', icon: <FaCog /> },
  ];

  return (
    <>
      <button
        className="md:hidden fixed top-2 left-2 z-50 bg-gray-800 text-white p-2 rounded"
        onClick={() => setOpen((o) => !o)}
      >
        &#9776;
      </button>
      <nav
        className={`fixed top-0 left-0 h-full w-60 bg-gray-800 text-white p-4 space-y-2 transform transition-transform duration-200 z-40
        ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <h2 className="text-lg font-bold mb-4">Menu</h2>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700 ${pathname === link.href ? 'bg-gray-700' : ''}`}
            onClick={() => setOpen(false)}
          >
            {link.icon}
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
