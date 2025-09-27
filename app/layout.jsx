import './globals.css';
import Sidebar from '../components/Sidebar';
import { ThemeProvider } from 'next-themes';

export const metadata = {
  title: 'Client Kanban System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Ir para o conteúdo
          </a>
          <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex-1 md:pl-72">
              <main id="main-content" className="relative z-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
