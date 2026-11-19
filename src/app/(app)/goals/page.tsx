import type { Metadata } from "next";
import { Suspense } from "react";
import { GoalsView } from "./goals-view";

export const metadata: Metadata = { title: "Savings Goals" };

export default function GoalsPage() {
  return (
    <Suspense>
      <GoalsView />
    </Suspense>
  );
}
