import { useParams } from "react-router-dom";

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();

  return (
    <div className="module-page">
      <h1>Module</h1>
      <p>Selected module: {moduleId ?? "none"}</p>
    </div>
  );
}
