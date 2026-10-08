import { LinkTabs } from "@/components/ui/tabs";

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="num mb-4 text-5xl font-semibold leading-none">Progressi</h1>
      <LinkTabs
        tabs={[
          { href: "/progress", label: "Panoramica", exact: true },
          { href: "/progress/body", label: "Corpo" },
          { href: "/progress/exercises", label: "Esercizi" },
          { href: "/progress/weight", label: "Peso" },
          { href: "/progress/goals", label: "Obiettivi" },
          { href: "/progress/achievements", label: "Traguardi" },
          { href: "/progress/leaderboard", label: "Classifica" },
        ]}
      />
      {children}
    </>
  );
}
