import "@/style.css";
import { Game } from "@/core/Game";

const canvas = document.getElementById("game-canvas");
const hudRoot = document.getElementById("hud");

if (!(canvas instanceof HTMLCanvasElement) || !(hudRoot instanceof HTMLElement)) {
  throw new Error("Game canvas or HUD root not found in the document.");
}

const game = new Game(canvas, hudRoot);
game.start();
