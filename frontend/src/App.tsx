import { useEffect, useState } from "react";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { api } from "./lib/api";
import { AuthGate } from "./components/AuthGate";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Income } from "./pages/Income";
import { Commitments } from "./pages/Commitments";
import { Transactions } from "./pages/Transactions";
import { Calendar as CalendarPage } from "./pages/Calendar";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "income", element: <Income /> },
      { path: "commitments", element: <Commitments /> },
      { path: "transactions", element: <Transactions /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },
      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

export default function App() {
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);

  useEffect(() => {
    api.authStatus()
      .then((s) => setAuthRequired(s.auth_required))
      .catch(() => setAuthRequired(false)); // API down: don't gate the shell
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: "1rem", background: "#C4788F", color: "#FFFFFF" },
        }}
      />
      {authRequired === null ? null : (
        <AuthGate authRequired={authRequired}>
          <RouterProvider router={router} />
        </AuthGate>
      )}
    </QueryClientProvider>
  );
}
