import { Request, Response } from "express";
import { io, pubClient } from "../server";

// Redis key to store user socket mappings
const userSocketMapKey = "user-socket-map";

export const isUserConnected = async (req: Request, res: Response): Promise<void> => {

  const { user } = req.body;

  try {
    const targetSocketId = await pubClient.hget(userSocketMapKey, user);

    if (targetSocketId && typeof targetSocketId === 'string') {
      res.status(200).send({
        "is-user-connected": true,
      });
    } else {
      res.status(200).send({
        "is-user-connected": false,
      });
    }
  } catch (error) {
    console.error("Error finding user:", error);
    res.status(500).send("Error finding user.");
  }

};

// Function to send a private message to a specific user by userId
export const sendWSMessage = async (req: Request, res: Response): Promise<void> => {
  const { to, type, payload } = req.body;

  try {
    // Get the target user's socket ID from Redis
    const targetSocketId = await pubClient.hget(userSocketMapKey, to);

    if (targetSocketId && typeof targetSocketId === 'string') {
      // Check if the target user is connected to the current server
      const targetSocket = io.sockets.sockets.get(targetSocketId as string);

      if (targetSocket) {
        // If the user is connected to this server, send the message directly
        targetSocket.emit("ws-message", { type, payload });
        res.send(`Message sent to user ${to}!`);
      } else {
        // If the user is connected to another server, publish the message via Redis
        await pubClient.publish("send-message", JSON.stringify({ to, type, payload }));
        res.send(`Message sent to user ${to} via Redis Pub/Sub!`);
      }
    } else {
      res.status(404).send(`User with ID ${to} is not connected.`);
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).send("Error sending message.");
  }
};

// Function to broadcast a message to all connected clients
export const sendBroadcastMessage = (req: Request, res: Response): void => {
  try {
    // Broadcast a message to all connected clients on this server
    io.emit("broadcast-message", req.body);
    res.send("Message broadcasted to all connected clients!");
  } catch (error) {
    console.error("Error broadcasting message:", error);
    res.status(500).send("Error broadcasting message.");
  }
};
