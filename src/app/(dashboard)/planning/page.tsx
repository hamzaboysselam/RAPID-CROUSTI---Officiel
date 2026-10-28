import { Suspense } from "react";
import PlanningPageClient from "../PlanningPageClient";

export default function PlanningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PlanningPageClient />
    </Suspense>
  );
}
