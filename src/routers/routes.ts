import { Request, Response, Router } from "express";
import { authenticateJWT } from "../middlewares/authenticate";
import {
  sendWSMessage,
  isUserConnected,
  sendBroadcastMessage,
} from "../controllers/message.controller";

const router = Router();

// Health check route
router.get("/", (req: Request, res: Response) => {
  res.send("Websockets server is up and running...");
});

router.post("/api/user-connected", authenticateJWT, isUserConnected);
router.post("/api/send-ws-message", authenticateJWT, sendWSMessage);
router.post("/api/send-broadcast-message", authenticateJWT, sendBroadcastMessage);

export default router;
