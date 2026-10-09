import { LinkTabs } from "@/components/ui/tabs";

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="num mb-4 text-5xl font-semibold leading-none">Gym</h1>
      <LinkTabs
        tabs={[
          { href: "/gym", label: "Schede", exact: true },
          { href: "/gym/history", label: "Storico" },
          { href: "/gym/calendar", label: "Calendario" },
        ]}
      />
      {children}
    </>
  );
}
