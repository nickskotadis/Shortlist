import Nav from "@/components/Nav";
import ScoreClient from "./ScoreClient";

export default async function ScorePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Nav activePage="score" maxWidth="max-w-6xl" />
      <ScoreClient />
    </div>
  );
}
