import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
        // Les tableaux de bord restent synchronisés même lorsqu'un autre membre modifie les données.
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
      },
    },
  });
  const viteBase = import.meta.env.BASE_URL || "/";
  const basepath = viteBase === "/" ? "/" : viteBase.replace(/\/$/, "");

  const router = createRouter({
    routeTree,
    basepath,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};