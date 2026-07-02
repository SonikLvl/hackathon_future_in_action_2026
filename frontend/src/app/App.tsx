import { BraceletPage } from "@/pages/bracelet/BraceletPage";
import { BraceletPreviewPage } from "@/pages/bracelet-preview/BraceletPreviewPage";
import { DemoPage } from "@/pages/demo/DemoPage";

const routes = {
  "/": <DemoPage />,
  "/demo": <DemoPage />,
  "/bracelet": <BraceletPage />,
  "/bracelet-preview": <BraceletPreviewPage />,
} as const;

export function App() {
  const pathname = window.location.pathname as keyof typeof routes;

  return routes[pathname] ?? <DemoPage />;
}
