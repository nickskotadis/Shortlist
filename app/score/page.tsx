import Nav from "@/components/Nav";
import ScoreClient from "./ScoreClient";

export default async function ScorePage() {
  return (
    <div className="min-h-screen bg-[#090C18]">
      <Nav activePage="score" maxWidth="max-w-6xl" />
      <ScoreClient />
    </div>
  );
}
