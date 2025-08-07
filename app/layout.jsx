import './globals.css';
import Sidebar from '../components/Sidebar';
import Providers from './providers';

export const metadata = {
  title: 'Client Kanban System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen md:pl-60 bg-gray-100">
        <Sidebar />
        <Providers>
          <main className="p-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
