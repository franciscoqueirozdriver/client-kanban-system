import './globals.css';

export const metadata = {
  title: 'Client Kanban System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
