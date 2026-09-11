import { startApp } from "./startup";

void startApp(document.getElementById("root")!, () => import("./bootstrap"));
