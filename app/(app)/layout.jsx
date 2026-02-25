import Sidebar from '@/components/Sidebar';

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:pl-72">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Ir para o conteúdo
        </a>
        <main id="main-content" className="relative z-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
