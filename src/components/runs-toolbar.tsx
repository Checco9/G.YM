"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { ManualRunSheet } from "./manual-run-sheet";

export function ManualRunButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" icon="plus" onClick={() => setOpen(true)}>
        Registra una corsa
      </Button>
      {open && <ManualRunSheet today={today} onClose={() => setOpen(false)} />}
    </>
  );
}
