
'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/clientes', label: 'Clientes' },
    { href: '/kanban', label: 'Kanban' },
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
            className={`block px-2 py-1 rounded hover:bg-gray-700 ${pathname === link.href ? 'bg-gray-700' : ''}`}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
