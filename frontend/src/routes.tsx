import { createBrowserRouter, Navigate } from "react-router-dom";
import { DesktopLayout } from "@/layouts/DesktopLayout";
import { Dashboard } from "@/pages/Dashboard";
import { ModulePage } from "@/pages/ModulePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DesktopLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "home", element: <Navigate to="/" replace /> },
      { path: ":moduleId", element: <ModulePage /> },
    ],
  },
]);

