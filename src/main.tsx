import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// vite-plugin-pwa: this import auto-registers the service worker.
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
  onRegisteredSW(_url, _registration) {
    // no-op; the toaster surfaces errors elsewhere
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
